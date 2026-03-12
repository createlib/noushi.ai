import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db/db';

export interface AIResult {
    date: string;
    description: string;
    debits: { code: number; amount: number }[];
    credits: { code: number; amount: number }[];
    isPersonalUse?: boolean;
}

export async function analyzeReceipt(base64Image: string, mimeType: string): Promise<AIResult | null> {
    // Fetch API key from DB
    const settings = await db.settings.get(1);
    if (!settings?.geminiApiKey) {
        throw new Error('API Key is missing. Please set it in Settings.');
    }

    // Fetch accounts to build context
    const accounts = await db.accounts.toArray();
    const contextText = accounts.map(a => `${a.code}: ${a.name} (${a.type === 'debit' ? '借方' : '貸方'})`).join('\n');

    // Fetch recent transactions for contextual learning (Few-shot prompting for user's habits)
    const recentTransactions = await db.transactions.orderBy('createdAt').reverse().limit(30).toArray();
    let historyContext = "過去の仕訳履歴がありません。";
    if (recentTransactions.length > 0) {
        historyContext = recentTransactions.map(t => {
            const debits = t.debits.map(d => `${d.code}(¥${d.amount})`).join(', ');
            const credits = t.credits.map(c => `${c.code}(¥${c.amount})`).join(', ');
            return `- 摘要: "${t.description}", 借方: [${debits}], 貸方: [${credits}]`;
        }).join('\n');
    }

    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);

    // v1betaで404が出るケースの回避策として、明示的にmodelVersion等のフォールバック設定を行うか、
    // fetchカスタムオプションでv1へのAPI向き先変更を試みます （SDK経由なので基本は自動ですが）
    const modelName = settings.aiModel || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({
        model: modelName,
    });

    const prompt = `
あなたはプロの税理士です。提供されたレシートから以下の情報を抽出し、必ず指定したJSONフォーマットで返答してください。
他の文章は一切含めず、JSONのみを返してください。

以下の勘定科目マスターのリストを参照し、複数行を含む可能性がある「借方(debits)」と「貸方(credits)」のリストを作成してください。

重要な指示（特に農業や不動産などの事業者の場合）:
1. レシートの中に複数の異なる性質の品目（例: 「農薬」と「事務用品」と「肥料」が混在）がある場合、必ずそれらを合算せず、別々の借方行として明細化してください。
2. 摘要（description）には、単に「ホームセンター代」とするのではなく、購入した具体的な品目名が分かるように記載してください。（例: 「カインズ: 農薬(ラウンドアップ), 肥料, ボールペン」）
3. ユーザーの過去の仕訳履歴を参考にし、過去に似た品目や店舗名がどの勘定科目に仕分けられているかを学習（模倣）してください。

勘定科目マスター:
${contextText}

ユーザーの過去の仕訳履歴 (参考にして推論精度を高めてください):
${historyContext}

要求するJSONフォーマット（配列の1要素としてそれぞれの科目を含めます）:
{
  "date": "YYYY-MM-DD",
  "description": "内容を推測して短く",
  "debits": [
    { "code": 710, "amount": 1000 },
    { "code": 725, "amount": 200 }
  ],
  "credits": [
    { "code": 100, "amount": 1200 }
  ]
}
`;

    try {
        const imagePart = {
            inlineData: {
                data: base64Image.split(',')[1], // remove base64 header like data:image/jpeg;base64,
                mimeType
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();

        console.log("Raw LLM Response:", responseText);

        // Try to safely extract JSON (in case model added markdown codeblocks)
        const jsonStrMatch = responseText.match(/```(?:json)?([\s\S]*?)```/);
        const parseTarget = jsonStrMatch ? jsonStrMatch[1].trim() : responseText.trim();

        return JSON.parse(parseTarget) as AIResult;
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        // モデル404エラーの場合は分かりやすいメッセージを返す
        if (error.message && error.message.includes('404')) {
            throw new Error(`指定されたAIモデル(${modelName})へのアクセス権限がないか、モデルが存在しません。設定画面から別のモデルを選択してください。\n詳細: ${error.message}`);
        }
        throw error;
    }
}

export async function analyzeCSVRow(csvRow: string): Promise<AIResult | null> {
    const settings = await db.settings.get(1);
    const accounts = await db.accounts.toArray();
    const contextText = accounts.map(a => `${a.code}: ${a.name} (${a.type === 'debit' ? '借方' : '貸方'})`).join('\n');

    const recentTransactions = await db.transactions.orderBy('createdAt').reverse().limit(30).toArray();
    let historyContext = "過去の仕訳履歴がありません。";
    if (recentTransactions.length > 0) {
        historyContext = recentTransactions.map(t => {
            const debits = t.debits.map(d => `${d.code}(¥${d.amount})`).join(', ');
            const credits = t.credits.map(c => `${c.code}(¥${c.amount})`).join(', ');
            return `- 摘要: "${t.description}", 借方: [${debits}], 貸方: [${credits}]`;
        }).join('\n');
    }

    const genAI = new GoogleGenerativeAI(settings?.geminiApiKey || '');
    const model = genAI.getGenerativeModel({ model: settings?.aiModel || "gemini-2.5-flash" });

    const prompt = `
あなたはプロの税理士です。銀行の入出金明細やクレジットカードの利用明細のCSVの1行がテキストとして渡されます。
以下の勘定科目マスターを参照し、自動で仕訳を推論してJSONで返してください。

もしこの取引が事業に無関係な個人的な支出（プライベートな買い物や生活費など）である可能性が高い場合は、"isPersonalUse": true に設定してください。事業に関連しそうな場合は false または除外してください。

重要な指示:
ユーザーの過去の仕訳履歴を参考にし、過去に似た品目や店舗・摘要がどの勘定科目に仕分けられているかを学習（模倣）してください。
（たとえば、過去に「Amazon」が「消耗品費」や「書籍代」になっているか等を参照します）

勘定科目マスター:
${contextText}

ユーザーの過去の仕訳履歴 (参考にして推論精度を高めてください):
${historyContext}

要求するJSONフォーマット:
{
  "date": "YYYY-MM-DD",
  "description": "内容を推測して短く",
  "debits": [ { "code": 710, "amount": 1000 } ],
  "credits": [ { "code": 100, "amount": 1200 } ],
  "isPersonalUse": false
}

CSVデータ行:
${csvRow}
`;

    try {
        const result = await model.generateContent([prompt]);
        const responseText = result.response.text();
        const jsonStrMatch = responseText.match(/```(?:json)?([\s\S]*?)```/);
        const parseTarget = jsonStrMatch ? jsonStrMatch[1].trim() : responseText.trim();
        return JSON.parse(parseTarget) as AIResult;
    } catch (e) {
        console.error("CSV AI Error:", e);
        throw e;
    }
}
