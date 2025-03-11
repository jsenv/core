// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/numeric-separators-style.js

export const inspectNumber = (value, { numericSeparator }) => {
  if (isNegativeZero(value)) {
    return "-0";
  }
  // isNaN
  // eslint-disable-next-line no-self-compare
  if (value !== value) {
    return "NaN";
  }
  if (value === Infinity) {
    return "Infinity";
  }
  if (value === -Infinity) {
    return "-Infinity";
  }
  const numberString = String(value);
  if (!numericSeparator) {
    return numberString;
  }
  const {
    number,
    mark = "",
    sign = "",
    power = "",
  } = numberString.match(
    /^(?<number>.*?)(?:(?<mark>e)(?<sign>[+-])?(?<power>\d+))?$/i,
  ).groups;
  const numberWithSeparators = formatNumber(number);
  const powerWithSeparators = addSeparator(power, {
    minimumDigits: 5,
    groupLength: 3,
  });
  return `${numberWithSeparators}${mark}${sign}${powerWithSeparators}`;
};

// Use this and instead of Object.is(value, -0)
// because in some corner cases firefox returns false
// for Object.is(-0, -0)
const isNegativeZero = (value) => {
  return value === 0 && 1 / value === -Infinity;
};

const formatNumber = (numberString) => {
  const parts = numberString.split(".");
  const [integer, fractional] = parts;

  if (parts.length === 2) {
    const integerWithSeparators = addSeparator(integer, {
      minimumDigits: 5,
      groupLength: 3,
    });
    return `${integerWithSeparators}.${fractional}`;
  }

  return addSeparator(integer, {
    minimumDigits: 5,
    groupLength: 3,
  });
};

const addSeparator = (numberString, { minimumDigits, groupLength }) => {
  if (numberString[0] === "-") {
    return `-${groupDigits(numberString.slice(1), {
      minimumDigits,
      groupLength,
    })}`;
  }
  return groupDigits(numberString, { minimumDigits, groupLength });
};

const groupDigits = (digits, { minimumDigits, groupLength }) => {
  const digitCount = digits.length;
  if (digitCount < minimumDigits) {
    return digits;
  }

  let digitsWithSeparator = digits.slice(-groupLength);
  let remainingDigits = digits.slice(0, -groupLength);
  while (remainingDigits.length) {
    const group = remainingDigits.slice(-groupLength);
    remainingDigits = remainingDigits.slice(0, -groupLength);
    digitsWithSeparator = `${group}_${digitsWithSeparator}`;
  }
  return digitsWithSeparator;
};

// const addSeparatorFromLeft = (value, { minimumDigits, groupLength }) => {
//   const { length } = value;
//   if (length < minimumDigits) {
//     return value;
//   }

//   const parts = [];
//   for (let start = 0; start < length; start += groupLength) {
//     const end = Math.min(start + groupLength, length);
//     parts.push(value.slice(start, end));
//   }
//   return parts.join("_");
// };
