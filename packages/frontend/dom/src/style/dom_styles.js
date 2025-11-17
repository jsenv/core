import { elementToOwnerWindow } from "../utils.js";
import { normalizeStyle } from "./style_parsing.js";

export const getComputedStyle = (element) => {
  return elementToOwnerWindow(element).getComputedStyle(element);
};

export const getStyle = (element, name, context) => {
  const computedStyle = getComputedStyle(element);
  const value = isCamelCase(name)
    ? computedStyle[name]
    : computedStyle.getPropertyValue(name);
  return normalizeStyle(value, name, context, element);
};

const isCamelCase = (str) => {
  // Check if string contains lowercase letter followed by uppercase letter (camelCase pattern)
  return /[a-z][A-Z]/.test(str);
};
const kebabCase = (str) => {
  // Convert camelCase to kebab-case by inserting a hyphen before uppercase letters
  // and converting the uppercase letter to lowercase
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
};
export const setStyle = (element, name, value) => {
  if (import.meta.dev) {
    if (isCamelCase(name)) {
      console.warn(
        `setStyle: style name "${name}" should be in kebab-case, not camelCase. Use "${kebabCase(name)}" instead.`,
      );
    }
  }

  const prevValue = element.style[name];
  if (prevValue) {
    element.style.setProperty(name, value);
    return () => {
      element.style.setProperty(name, prevValue);
    };
  }
  element.style.setProperty(name, value);
  return () => {
    element.style.removeProperty(name);
  };
};
export const forceStyle = (element, name, value) => {
  const inlineStyleValue = element.style[name];
  if (inlineStyleValue === value) {
    return () => {};
  }
  const computedStyleValue = getStyle(element, name);
  if (computedStyleValue === value) {
    return () => {};
  }
  const restoreStyle = setStyle(element, name, value);
  return restoreStyle;
};

const createSetMany = (setter) => {
  return (element, description) => {
    const cleanupCallbackSet = new Set();
    for (const name of Object.keys(description)) {
      const value = description[name];
      const restoreStyle = setter(element, name, value);
      cleanupCallbackSet.add(restoreStyle);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
  };
};

export const setStyles = createSetMany(setStyle);
export const forceStyles = createSetMany(forceStyle);
