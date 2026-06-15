
  // Function to format US phone numbers
  export function formatUSNumber(number: string): string {
    const areaCode = number.substring(1, 4);
    const prefix = number.substring(4, 7);
    const lineNumber = number.substring(7);
    return `(${areaCode})-${prefix}-${lineNumber}`;
  }

  // Function to format UK phone numbers
 export function formatUKNumber(number: string): string {
    const ukNumber = number.substring(2); // Remove the country code
    const areaCode = ukNumber.substring(0, 4);
    const prefix = ukNumber.substring(4, 7);
    const lineNumber = ukNumber.substring(7);
    return `(${areaCode})-${prefix}-${lineNumber}`;
  }

  // Function to format Ireland phone numbers
 export function formatIrelandNumber(number: string): string {
    const ireNumber = number.substring(3); // Remove the country code
    let areaCode = "";
    let prefix = "";
    let lineNumber = "";

    if (ireNumber.length === 8) {
      // Dublin area code (1 digit)
      areaCode = ireNumber.substring(0, 1);
      prefix = ireNumber.substring(1, 4);
      lineNumber = ireNumber.substring(4);
    } else {
      // Other areas or mobile numbers (area code 2 digits)
      areaCode = ireNumber.substring(0, 2);
      prefix = ireNumber.substring(2, 5);
      lineNumber = ireNumber.substring(5);
    }

    return `(${areaCode})-${prefix}-${lineNumber}`;
  }