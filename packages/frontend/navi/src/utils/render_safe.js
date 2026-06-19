import { isValidElement } from "preact";

// When a component render a prop that can be anything (js value of preact element)
// make sure it cannot throw during render by converting it to a string if it's not a valid preact element or a primitive value
export const renderSafe = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (isValidElement(value)) {
    return value;
  }

  return String(value);
};
