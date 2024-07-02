export const groupDigits = (digitsAsString) => {
  const digitCount = digitsAsString.length;
  if (digitCount < 4) {
    return digitsAsString;
  }

  let digitsWithSeparator = digitsAsString.slice(-3);
  let remainingDigits = digitsAsString.slice(0, -3);
  while (remainingDigits.length) {
    const group = remainingDigits.slice(-3);
    remainingDigits = remainingDigits.slice(0, -3);
    digitsWithSeparator = `${group}_${digitsWithSeparator}`;
  }
  return digitsWithSeparator;
};
