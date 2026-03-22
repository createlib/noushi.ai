// src/utils/accountMapping.ts

// Define mappings between business and private account names
const businessToPrivateMap: Record<string, string> = {
    "現金": "現金（家計）",
    "普通預金": "普通預金（家計）",
    "未払金": "クレジットカード（家計）",
    "借入金": "その他の借入・ローン（家計）",
    "消耗品費": "日用品費",
    "事務用品費": "日用品費",
    "接待交際費": "交際費",
    "会議費": "交際費",
    "旅費交通費": "交通費",
    "通信費": "通信費", // name is the same, but id/code will differ
    "地代家賃": "家賃",
    "水道光熱費": "電気代", // defaults to electricity
    "租税公課": "税金",
    "雑費": "特別支出"
};

const privateToBusinessMap: Record<string, string> = {
    "現金（家計）": "現金",
    "普通預金（家計）": "普通預金",
    "クレジットカード（家計）": "未払金",
    "その他の借入・ローン（家計）": "借入金",
    "日用品費": "消耗品費",
    "交際費": "接待交際費",
    "交通費": "旅費交通費",
    "車費": "旅費交通費",
    "通信費": "通信費",
    "家賃": "地代家賃",
    "電気代": "水道光熱費",
    "ガス代": "水道光熱費",
    "水道代": "水道光熱費",
    "税金": "租税公課",
    "特別支出": "雑費"
};

export function getToggledAccountId(
    currentAccountId: number | string | null,
    isTurningPrivate: boolean,
    accounts: any[]
): number | string | null {
    if (!currentAccountId) return null;

    const currentAcc = accounts.find(a => String(a.code || a.id) === String(currentAccountId));
    if (!currentAcc) return currentAccountId;

    const mapToUse = isTurningPrivate ? businessToPrivateMap : privateToBusinessMap;
    const targetName = mapToUse[currentAcc.name];

    if (!targetName) return currentAccountId; // No mapping found, keep the current one (it might disappear from the dropdown, but that forces user to pick)

    // Find the target account by name AND specific range to prevent picking the wrong "通信費"
    const targetAcc = accounts.find(a => {
        if (a.name !== targetName) return false;
        
        const codeNum = typeof a.code === 'number' ? a.code : parseInt(String(a.code), 10);
        const isPrivateCode = codeNum >= 9800 && codeNum <= 9989;
        
        if (isTurningPrivate) {
            return isPrivateCode; // looking for private match
        } else {
            return !isPrivateCode; // looking for business match
        }
    });

    if (targetAcc) {
        return targetAcc.code || targetAcc.id;
    }

    return currentAccountId;
}
