// src/utils/accountMapping.ts

// Define mappings between business and private account names
const businessToPrivateMap: Record<string, string> = {
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

    // If it's a cash/bank account, those names are shared or identical (100, 111)
    // Actually, cash/bank shouldn't be mapped because they are valid in both modes now.
    // However, if we want to map "現金" (100) -> "現金（家計）" (9801) it could be helpful, but the user explicitly requested 100/111 to remain available in private mode. So we leave them.
    if (currentAcc.code === 100 || currentAcc.code === 111) {
        return currentAccountId;
    }

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
