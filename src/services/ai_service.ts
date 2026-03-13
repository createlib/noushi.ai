import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db/db';

export interface AIResult {
    date: string;
    description: string;
    debits: { code: number; amount: number }[];
    credits: { code: number; amount: number }[];
    isPersonalUse?: boolean;
}

const TYPE_TRANSLATION: Record<string, string> = {
    'asset': '資産 (借方)',
    'liability': '負債 (貸方)',
    'equity': '純資産 (貸方)',
    'revenue': '収益 (貸方)',
    'expense': '費用 (借方)'
};

async function buildHistoryContext(): Promise<string> {
    const recentJournals = await db.journals.orderBy('createdAt').reverse().limit(30).toArray();
    if (recentJournals.length === 0) return "過去の仕訳履歴がありません。";

    const jIds = recentJournals.map(j => j.id);
    const lines = await db.journal_lines.where('journal_id').anyOf(jIds).toArray();

    return recentJournals.map(j => {
        const jLines = lines.filter(l => l.journal_id === j.id);
        const debits = jLines.filter(l => l.debit > 0).map(d => `${d.account_id}(¥${d.debit})`).join(', ');
        const credits = jLines.filter(l => l.credit > 0).map(c => `${c.account_id}(¥${c.credit})`).join(', ');
        return `- 摘要: "${j.description}", 借方: [${debits}], 貸方: [${credits}]`;
    }).join('\n');
}

export async function analyzeReceipt(base64Image: string, mimeType: string): Promise<AIResult | null> {
    // Fetch API key from DB
    const settings = await db.settings.get(1);
    if (!settings?.geminiApiKey) {
        throw new Error('API Key is missing. Please set it in Settings.');
    }

    // Fetch accounts to build context
    const accounts = await db.accounts.toArray();
    const contextText = accounts.map(a => `${a.id}: ${a.name} (${TYPE_TRANSLATION[a.type]})`).join('\n');

    // Fetch recent transactions for contextual learning
    const historyContext = await buildHistoryContext();

    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);

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
                data: base64Image.split(',')[1],
                mimeType
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();

        console.log("Raw LLM Response:", responseText);

        const jsonStrMatch = responseText.match(/```(?:json)?([\s\S]*?)```/);
        const parseTarget = jsonStrMatch ? jsonStrMatch[1].trim() : responseText.trim();

        return JSON.parse(parseTarget) as AIResult;
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        if (error.message && error.message.includes('404')) {
            throw new Error(`指定されたAIモデル(${modelName})へのアクセス権限がないか、モデルが存在しません。設定画面から別のモデルを選択してください。\n詳細: ${error.message}`);
        }
        throw error;
    }
}

export async function analyzeCSVRow(csvRow: string): Promise<AIResult | null> {
    const settings = await db.settings.get(1);
    const accounts = await db.accounts.toArray();
    const contextText = accounts.map(a => `${a.id}: ${a.name} (${TYPE_TRANSLATION[a.type]})`).join('\n');

    const historyContext = await buildHistoryContext();

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
