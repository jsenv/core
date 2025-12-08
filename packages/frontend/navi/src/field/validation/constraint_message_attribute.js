import { createNaviMirror } from "./navi_mirror.js";

export const getMessageFromAttribute = (element, attributeName, message) => {
  const selectorAttributeName = `${attributeName}-selector`;
  const eventAttributeName = `${attributeName}-event`;

  const fromAttribute = (element) => {
    if (!element) {
      return null;
    }
    const messageAttribute = element.getAttribute(attributeName);
    if (messageAttribute) {
      return messageAttribute;
    }
    const selectorAttribute = element.getAttribute(selectorAttributeName);
    if (selectorAttribute) {
      return fromSelectorAttribute(selectorAttribute, message);
    }
    const eventAttribute = element.getAttribute(eventAttributeName);
    if (eventAttribute) {
      return fromEventAttribute(element, eventAttribute, message);
    }
    return null;
  };

  return (
    fromAttribute(element) ||
    fromAttribute(element.closest("fieldset")) ||
    fromAttribute(element.closest("form")) ||
    null
  );
};

const fromEventAttribute = (element, eventName) => {
  return (calloutContext) => {
    element.dispatchEvent(
      new CustomEvent(eventName, { detail: calloutContext }),
    );
  };
};

// Helper function to resolve messages that might be CSS selectors
const fromSelectorAttribute = (messageAttributeValue) => {
  // It's a CSS selector, find the DOM element
  const messageSourceElement = document.querySelector(messageAttributeValue);
  if (!messageSourceElement) {
    console.warn(
      `Message selector "${messageAttributeValue}" not found in DOM`,
    );
    return null; // Fallback to the generic message
  }
  const mirror = createNaviMirror(messageSourceElement);
  mirror.setAttribute("data-source-selector", messageAttributeValue);
  return mirror;
};
