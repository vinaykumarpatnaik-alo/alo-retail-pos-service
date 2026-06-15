const validateName = (text) => {
    // Add your validation logic here
    const regex = /^[A-Za-z]+$/; // Only alphabetic characters
    return regex.test(text);
};


const validateEmail = (text) => {
    // Add your email validation logic here
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic email validation
    return regex.test(text);
};


const validatePhoneNumber = (text) => {
    // Add your phone number validation logic here
    const regex = /^\d{10,}$/; // At least 10 digits
    return text.length === 0 || regex.test(text);
};


export {validateEmail,validateName,validatePhoneNumber};