import { dispatchCustomEvent } from "@jsenv/dom";

import { getUIStateFromElement } from "./ui_state_controller.js";

export const asControlHostValue = (value, { controlType, type }) => {
  if (controlType === "input") {
    if (type === "datetime-local") {
      return asDatetimeLocalString(value);
    }
    if (type === "number" || type === "range") {
      return asNumberString(value);
    }
    if (type === "color") {
      return asColorString(value);
    }
    return asInputValue;
  }
  return value;
};
// As explained in https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local#setting_timezones
// datetime-local does not support timezones
const asDatetimeLocalString = (dateTimeString) => {
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
const asNumberString = (jsValue) => {
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
const asColorString = (jsValue) => {
  return jsValue || "#000000";
};
const asInputValue = (jsValue) => {
  if (jsValue === undefined) {
    return "";
  }
  return jsValue;
};

export const readControlValue = (controlHost) => {
  if (controlHost.tagName === "BUTTON") {
    return readValueFromButton(controlHost);
  }
  if (controlHost.tagName === "INPUT") {
    // important: input.type = "navi_picker" followed by input.type returns "text"
    // so use getAttribute
    const type = controlHost.getAttribute("type");

    if (type === "number" || type === "range") {
      return readNumberFromInput(controlHost);
    }
    if (type === "checkbox" || type === "radio") {
      return readValueFromCheckableInput(controlHost);
    }
    if (type === "datetime-local") {
      return readDatetimeLocalFromInput(controlHost);
    }
    if (type === "navi_picker") {
      return getUIStateFromElement(controlHost);
    }
  }
  return readValueFromInput(controlHost);
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
