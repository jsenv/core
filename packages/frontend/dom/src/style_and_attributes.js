import { elementToOwnerWindow } from "./utils.js";

export const getComputedStyle = (element) =>
  elementToOwnerWindow(element).getComputedStyle(element);

export const getStyle = (element, name) =>
  getComputedStyle(element).getPropertyValue(name);

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

export const setStyles = (element, styleDescription) => {
  const cleanupCallbackSet = new Set();
  for (const name of Object.keys(styleDescription)) {
    const value = styleDescription[name];
    const removeStyle = setStyle(element, name, value);
    cleanupCallbackSet.add(removeStyle);
  }
  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};

const setAttribute = (element, name, value) => {
  if (element.hasAttribute(name)) {
    const prevValue = element.getAttribute(name);
    element.setAttribute(name, value);
    return () => {
      element.setAttribute(name, prevValue);
    };
  }
  element.setAttribute(name, value);
  return () => {
    element.removeAttribute(name);
  };
};
export const setAttributes = (element, attributeDescription) => {
  const cleanupCallbackSet = new Set();
  for (const name of Object.keys(attributeDescription)) {
    const value = attributeDescription[name];
    const unsetAttribute = setAttribute(element, name, value);
    cleanupCallbackSet.add(unsetAttribute);
  }
  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};
