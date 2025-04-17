import { elementToOwnerWindow } from "./utils.js";

export const getComputedStyle = (element) =>
  elementToOwnerWindow(element).getComputedStyle(element);

export const getStyle = (element, name) =>
  getComputedStyle(element).getPropertyValue(name);

export const setStyle = (element, name, value) => {
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
