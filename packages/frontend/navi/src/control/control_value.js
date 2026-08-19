import { dispatchCustomEvent } from "@jsenv/dom";

import { getUIStateFromElement } from "./ui_state_dom.js";

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
export const asControlHostValue = (
  jsValue,
  { controlType, type, inputMode, pad },
) => {
  if (controlType === "select") {
    // A select holds one of its options, always a string; holding nothing is
    // the empty option, which the element spells "".
    return asInputValue(jsValue);
  }
  if (controlType === "input" || controlType === "picker") {
    if (type === "datetime-local") {
      return asDatetimeLocalString(jsValue);
    }
    if (
      type === "number" ||
      type === "range" ||
      inputMode === "numeric" ||
      inputMode === "decimal"
    ) {
      return asNumberString(jsValue, pad);
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
// `pad` is how many digits the number is WRITTEN on — an hour is held as 7 and
// shown as "07". Held and shown are two things here, the way they are for a
// datetime-local above: what the field says is derived from what the control
// holds, and reading it back (readNumberFromInput) gives the number again.
const asNumberString = (jsValue, pad) => {
  if (jsValue === undefined) {
    return "";
  }
  if (!pad || jsValue === "" || jsValue === null) {
    return jsValue;
  }
  const number = Number(jsValue);
  if (Number.isNaN(number)) {
    return jsValue;
  }
  const negative = number < 0;
  const digits = String(negative ? -number : number).padStart(Number(pad), "0");
  return negative ? `-${digits}` : digits;
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
    // important: input.type = "navi_js"; followed by input.type; returns "text"
    // so use getAttribute
    const type = controlHost.getAttribute("type");

    if (
      type === "number" ||
      type === "range" ||
      controlHost.inputMode === "numeric" ||
      controlHost.inputMode === "decimal"
    ) {
      return readNumberFromInput(controlHost);
    }
    if (type === "color") {
      return readValueFromControlHost(controlHost);
    }
    if (type === "checkbox" || type === "radio") {
      return readValueFromCheckableInput(controlHost);
    }
    if (type === "datetime-local") {
      return readDatetimeLocalFromInput(controlHost);
    }
    if (type === "navi_js") {
      return getUIStateFromElement(controlHost);
    }
    return readValueFromInput(controlHost);
  }
  if (controlHost.hasAttribute("navi-control-host")) {
    // Non-button, non-input navi controls (e.g. Badge.Button rendered as span)
    return readValueFromControlHost(controlHost);
  }
  return readValueFromElement(controlHost);
};
const readValueFromControlHost = (controlHost) => {
  return readValueFromNaviCustomEvent(controlHost, controlHost.value);
};
const readValueFromButton = (button) => {
  return readValueFromControlHost(button);
};
const readDatetimeLocalFromInput = (input) => {
  const localDateTimeString = input.value;
  if (localDateTimeString === "") {
    return "";
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
    return "";
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
  return readValueFromControlHost(input);
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

/**
 * A control is bound to EITHER a signal (two-way) or a value/checked prop,
 * never both — the two would fight over the state. The signal is the one that
 * wins; this says so in dev, wherever the question is decided (a leaf control
 * in control_hooks, a group in ui_state_controller).
 *
 * Only the controlled prop (value/checked) collides with signal — the default
 * prop (defaultValue/defaultChecked) is legitimately seeded from the signal by
 * resolveInputProps, so it must not warn here.
 */
export const warnSignalCollision = (props, controlType, stateProp) => {
  if (!import.meta.dev) {
    return;
  }
  if (Object.hasOwn(props, stateProp)) {
    console.warn(
      `[navi] "${controlType}" got both "signal" and "${stateProp}". ` +
        `"signal" is the source of truth; "${stateProp}" is ignored. ` +
        `Pass only "signal".`,
    );
  }
};
