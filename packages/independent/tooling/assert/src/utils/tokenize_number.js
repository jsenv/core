export const tokenizeInteger = (integerValue) => {
  const integerAsString = String(integerValue);
  const exponentIndex = integerAsString.indexOf("e");
  if (exponentIndex === -1) {
    return { integer: integerAsString };
  }
  const digitsAsString = integerAsString.slice(0, exponentIndex);
  const digitsValue = parseFloat(digitsAsString);
  const digitParts = tokenizeNonExponentialFloat(digitsValue);
  const digitsInteger = digitParts.integer;
  const digitsDecimal = digitParts.decimal;
  const afterExponent = integerAsString.slice(exponentIndex + 2); // "e" + "+"
  const numberOfTrailingZero = parseInt(afterExponent);
  let integer = "";
  integer = digitsInteger;
  integer += digitsDecimal;
  integer += afterExponent;
  integer += "0".repeat(numberOfTrailingZero);
  return { integer };
};

// see https://github.com/shrpne/from-exponential/blob/master/src/index.js
// https://github.com/shrpne/from-exponential/blob/master/test/index.test.js
export const tokenizeFloat = (floatValue) => {
  const floatAsString = String(floatValue);
  const exponentIndex = floatAsString.indexOf("e");
  if (exponentIndex === -1) {
    return tokenizeNonExponentialFloat(floatValue);
  }
  let decimal = "";
  let numberOfLeadingZero;
  const digitsAsString = floatAsString.slice(0, exponentIndex);
  const digitsValue = parseFloat(digitsAsString);
  const digitParts = tokenizeNonExponentialFloat(digitsValue);
  const digitsInteger = digitParts.integer;
  const digitsDecimal = digitParts.decimal;
  const decimalSeparator = digitsDecimal ? digitParts.decimalSeparator : ".";
  const afterExponent = floatAsString.slice(exponentIndex + 2); // "e" + "-"
  numberOfLeadingZero = parseInt(afterExponent);
  decimal += "0".repeat(numberOfLeadingZero);
  decimal += digitsInteger;
  decimal += digitsDecimal;
  return {
    integer: "0",
    decimalSeparator,
    decimal,
  };
};

const tokenizeNonExponentialFloat = (floatValue) => {
  const floatString = String(floatValue);
  const integer = Math.floor(floatValue);
  const integerAsString = String(integer);
  const decimalSeparator = floatString[integerAsString.length];
  const decimal = floatString.slice(integerAsString.length + 1);
  return {
    integer: integerAsString,
    decimalSeparator,
    decimal,
  };
};

// tokenizeFloat(1.2e-7);
// tokenizeFloat(2e-7);
