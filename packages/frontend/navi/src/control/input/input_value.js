export const getToInputValue = (type) => {
  if (type === "datetime-local") {
    return toDatetimeLocal;
  }
  if (type === "number" || type === "range") {
    return toNumber;
  }
  if (type === "color") {
    return toColor;
  }
  return toInputValue;
};
// As explained in https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local#setting_timezones
// datetime-local does not support timezones
const toDatetimeLocal = (dateTimeString) => {
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) {
    return dateTimeString;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};
const toNumber = (jsValue) => {
  const asNumber = Number(jsValue);
  if (isNaN(asNumber)) {
    return jsValue;
  }
  return asNumber;
};
// Browser requires a non-empty value for <input type="color">.
// When our logical value is empty we give it #000000 so it doesn't choke.
// The UI uses the original (possibly empty) value to show the checkerboard.
const toColor = (jsValue) => {
  return jsValue || "#000000";
};
const toInputValue = (jsValue) => jsValue;

export const getFromInputValue = (type) => {
  if (type === "datetime-local") {
    return fromDatetimeLocal;
  }
  if (type === "number" || type === "range") {
    return fromNumber;
  }
  return fromInputValue;
};
const fromDatetimeLocal = (localDateTimeString) => {
  if (!localDateTimeString) {
    return localDateTimeString;
  }
  const localDate = new Date(localDateTimeString);
  if (isNaN(localDate.getTime())) {
    return localDateTimeString;
  }
  return localDate.toISOString();
};
const fromNumber = (inputValue) => {
  if (inputValue === "") {
    return "";
  }
  const asNumber = Number(inputValue);
  if (isNaN(asNumber)) {
    return inputValue;
  }
  return asNumber;
};
const fromInputValue = (inputValue) => inputValue;
