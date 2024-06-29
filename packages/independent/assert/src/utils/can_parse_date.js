// canParseDate can be called on any string
// so we want to be sure it's a date before handling it as such
// And Date.parse is super permissive
// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// So we'll restrict permissivness
// A date like 1980/10/05 won't even be considered as a date

export const canParseDate = (value) => {
  if (/^[0-9]$/.test(value)) {
    return false;
  }
  if (/^[0-9]{2}$/.test(value)) {
    return false;
  }
  if (/^[0-9]{2}\//.test(value)) {
    return false;
  }
  if (/^.*\/[\d]+$/.test(value)) {
    return false;
  }
  if (/^.*\-[\d]+$/.test(value)) {
    return false;
  }
  if (value.includes("\n")) {
    return false;
  }
  if (!isNaN(value)) {
    return false;
  }
  const returnValue = Date.parse(value);
  // eslint-disable-next-line no-self-compare
  if (returnValue !== returnValue) {
    return false;
  }
  return true;
};
