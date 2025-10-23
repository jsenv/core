import { elementToOwnerWindow } from "../utils.js";

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

export const addWillChange = (element, property) => {
  const currentWillChange = element.style.willChange;
  const willChangeValues = currentWillChange
    ? currentWillChange
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  if (willChangeValues.includes(property)) {
    // Property already exists, return no-op
    return () => {};
  }

  willChangeValues.push(property);
  element.style.willChange = willChangeValues.join(", ");
  // Return function to remove only this property
  return () => {
    const newValues = willChangeValues.filter((v) => v !== property);
    if (newValues.length === 0) {
      element.style.removeProperty("will-change");
    } else {
      element.style.willChange = newValues.join(", ");
    }
  };
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
