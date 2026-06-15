import util from 'util';

export const formatSanitizeInput = (formatString, ...inputs) => {
  // Replace any potential format specifiers to prevent unintended interpretation
  const sanitizedInput = inputs.map((input) => input.toString().replace(/%([a-zA-Z%])/g, '%%$1'));
  return util.format(formatString, ...sanitizedInput);
}
