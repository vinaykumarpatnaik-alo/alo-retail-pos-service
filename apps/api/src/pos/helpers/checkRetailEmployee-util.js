const isRetailEmployee = (storeInfo) => {
    if (!storeInfo || typeof storeInfo !== "string") {
        console.log("Not a retail Employee :: store info  ", storeInfo);
        return false;
    }

    // Check if the string starts with a number (store number)
    if (/^\d+/.test(storeInfo) || /\(\d+\)\s*$/.test(storeInfo)) {
        const splitInfo = storeInfo.split(' - ', 2);
        const storeNumber = storeInfo.match(/\((\d+)\)\s*$/)?.[1] || splitInfo[0];
        const storeName = splitInfo.length > 1 ? splitInfo[1] : '';
        console.log("Retail Employee :: Has store number and name ", storeNumber, storeName);
        return true;

    } else {
        console.log("Not a retail Employee :: store info  ", storeInfo);
        return false;
    }
}
export { isRetailEmployee }
