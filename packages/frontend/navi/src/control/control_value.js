import { dispatchCustomEvent } from "@jsenv/dom";

import { getUIStateFromElement } from "./ui_state_controller.js";

/**
 * Converts a JS value into the form expected by the browser DOM property for a
 * given control type/input type combination.
 *
 * For example:
 * - `datetime-local` inputs expect a local datetime string without timezone
 * - `number`/`range` inputs expect a numeric string or number
 * - `color` inputs require a non-empty hex string (falls back to `#000000`)
 * - All other inputs receive the value as-is (undefined → "")
 *
 * Returns either the converted value directly, or a converter function when the
 * conversion depends on the runtime value (e.g. plain inputs return `asInputValue`).
 *
 * @param {any} value - The JS value to convert.
 * @param {{ controlType: string, type: string }} options
 * @returns {any} The DOM-compatible value or a converter function.
 */
export const asControlHostValue = (jsValue, { controlType, type }) => {
  if (controlType === "input") {
    if (type === "datetime-local") {
      return asDatetimeLocalString(jsValue);
    }
    if (type === "number" || type === "range") {
      return asNumberString(jsValue);
    }
    if (type === "color") {
      return asColorString(jsValue);
    }
    return asInputValue(jsValue);
  }
  return jsValue;
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
  return jsValue;
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

/**
 * Reads the current logical JS value from a control host DOM element.
 *
 * Handles all navi control host element types:
 * - `<button>` — reads via `navi_get_value` custom event, falls back to `button.value`
 * - `<input type="number|range">` — parses as a number, returns `undefined` when empty
 * - `<input type="checkbox|radio">` — returns `undefined` when unchecked, otherwise reads
 *   via `navi_get_value` custom event (to preserve the original JS type of the value prop)
 * - `<input type="datetime-local">` — converts the local datetime string to an ISO 8601 string
 * - `<input type="navi_picker">` — delegates to the controller via `navi_get_ui_state`
 * - All other inputs — returns `input.value` as a string
 *
 * @param {HTMLElement} controlHost - The control host DOM element to read from.
 * @returns {any} The current logical value of the control.
 */
export const readControlValue = (controlHost) => {
  if (
    controlHost.tagName === "BUTTON" ||
    controlHost.getAttribute("role") === "button"
  ) {
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
    return readValueFromInput(controlHost);
  }
  if (controlHost.hasAttribute("navi-control-host")) {
    // Non-button, non-input navi controls (e.g. Badge.Button rendered as span)
    return readValueFromNaviCustomEvent(controlHost, controlHost.value);
  }
  return readValueFromElement(controlHost);
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
const readValueFromElement = (element) => {
  const value = element.value;
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
