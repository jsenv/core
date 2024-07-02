// canParseDate can be called on any string
// so we want to be sure it's a date before handling it as such
// And Date.parse is super permissive
// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// So we'll restrict permissivness
// A date like 1980/10/05 won't even be considered as a date

export const canParseDate = (value) => {
  const dateParseResult = Date.parse(value);
  // eslint-disable-next-line no-self-compare
  if (dateParseResult !== dateParseResult) {
    return false;
  }
  // Iso format
  // "1995-12-04 00:12:00.000Z"
  if (
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?([\+\-]\d{2}\:\d{2}|Z)?$/.test(
      value,
    )
  ) {
    return true;
  }

  // GMT format
  // "Tue May 07 2024 11:27:04 GMT+0200 (Central European Summer Time)",
  if (
    /^[a-zA-Z]{0,4} [a-z-A-Z]{0,4} [0-9]{2} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT([\+\-][0-9]{0,4})?( \((.*)\))?$/.test(
      value,
    )
  ) {
    return true;
  }
  // other format
  // "Thu, 01 Jan 1970 00:00:00"
  if (
    /^[a-zA-Z]{3}, [0-9]{2} [a-zA-Z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(
      value,
    )
  ) {
    return true;
  }
  return false;
};

export const usesTimezone = (value) => {
  if (value[value.length - 1] === "Z") {
    return true;
  }
  if (value.includes("UTC")) {
    return true;
  }
  if (value.includes("GMT")) {
    return true;
  }
  if (/[\+-]\d{2}:\d{2}$/.test(value)) {
    return true;
  }
  return false;
};
