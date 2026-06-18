  export default function formatPhoneNumber(phoneNumber) {
    // Regular expression to match phone numbers in the format +14156786578, +917907780987, or 4547878987
    let phoneRegex = /^(\+?\d{1,3})?(\d{10})$/;
  
    // Check if the phone number matches the regular expression
    if (!phoneRegex.test(phoneNumber)) {
        console.log("Phone number not matching matching")
        console.log(phoneNumber)
      return phoneNumber;
    }else{
        console.log("Phone number format matching")
        console.log(phoneNumber)
    }
  
    // Extract the country code and phone number digits
    let [, countryCode, phoneNumberDigits] = phoneRegex.exec(phoneNumber);
  
    // Format the phone number based on the country code
    if (countryCode) {
      return `(${phoneNumberDigits.substr(0, 3)})-${phoneNumberDigits.substr(3, 3)}-${phoneNumberDigits.substr(6)}`;
    } else {
      return `(${phoneNumberDigits.substr(0, 3)})-${phoneNumberDigits.substr(3, 3)}-${phoneNumberDigits.substr(6)}`;
    }
  }
  