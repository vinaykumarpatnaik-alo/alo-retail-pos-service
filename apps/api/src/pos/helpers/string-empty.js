export default function isStringEmpty(str) {
    if (str === undefined || str === null) {
      return true;
    }
    
    // Trim the string and check if it's empty
    const trimmedStr = str.trim();
    return trimmedStr.length === 0;
  }