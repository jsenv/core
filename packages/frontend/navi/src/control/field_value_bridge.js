import { dispatchCustomEvent } from "@jsenv/dom";

import { getUIStateFromElement } from "./ui_state_controller.js";

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
  if (jsValue === undefined) {
    return "";
  }
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
const toInputValue = (jsValue) => {
  return jsValue === undefined ? "" : jsValue;
};

export const readFieldValue = (field) => {
  if (field.tagName === "BUTTON") {
    return readValueFromButton(field);
  }
  if (field.tagName === "INPUT") {
    // important: input.type = "navi_picker" followed by input.type returns "text"
    // so use getAttribute
    const type = field.getAttribute("type");

    if (type === "number" || type === "range") {
      return readNumberFromInput(field);
    }
    if (type === "checkbox" || type === "radio") {
      return readValueFromCheckableInput(field);
    }
    if (type === "datetime-local") {
      return readDatetimeLocalFromInput(field);
    }
    if (type === "navi_picker") {
      return getUIStateFromElement(field);
    }
  }
  return readValueFromInput(field);
};
const readValueFromButton = (button) => {
  return readValueFromNaviCustomEvent(button, button.value);
};
const readDatetimeLocalFromInput = (input) => {
  const localDateTimeString = input.value;
  if (localDateTimeString === "") {
    return undefined;
  }
  const localDate = new Date(localDateTimeString);
  if (isNaN(localDate.getTime())) {
    return localDateTimeString;
  }
  return localDate.toISOString();
};
const readNumberFromInput = (input) => {
  const numberString = input.value;
  if (numberString === "") {
    return undefined;
  }
  const asNumber = Number(numberString);
  if (isNaN(asNumber)) {
    return numberString;
  }
  return asNumber;
};
const readValueFromCheckableInput = (input) => {
  const checked = input.checked;
  if (!checked) {
    return undefined;
  }
  return readValueFromNaviCustomEvent(input, input.value);
};
const readValueFromInput = (input) => {
  const value = input.value;
  return value;
};

const readValueFromNaviCustomEvent = (field, fallback) => {
  // prefer the value given as prop (respect original type, browser would convert to string)
  let responded;
  let value;
  dispatchCustomEvent(field, "navi_get_value", {
    respondWith: (jsValue) => {
      responded = true;
      value = jsValue;
    },
  });
  if (responded) {
    return value;
  }
  return fallback;
};
