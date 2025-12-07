import { createNaviMirror } from "./navi_mirror.js";

export const getMessageFromAttribute = (element, attributeName, message) => {
  const messageAttribute = element.getAttribute(attributeName);
  if (messageAttribute) {
    return resolveMessageFromAttribute(messageAttribute, message);
  }
  const closestFieldset = element.closest("fieldset");
  if (closestFieldset) {
    const fieldsetMessageAttribute =
      closestFieldset.querySelector(attributeName);
    if (fieldsetMessageAttribute) {
      return resolveMessageFromAttribute(fieldsetMessageAttribute, message);
    }
  }
  const closestForm = element.closest("form");
  if (closestForm) {
    const formMessageAttribute = closestForm.querySelector(attributeName);
    if (formMessageAttribute) {
      return resolveMessageFromAttribute(formMessageAttribute, message);
    }
  }
  return null;
};

// Helper function to resolve messages that might be CSS selectors
const resolveMessageFromAttribute = (messageAttributeValue) => {
  if (typeof messageAttributeValue !== "string") {
    return messageAttributeValue;
  }
  if (!messageAttributeValue.startsWith("#")) {
    return messageAttributeValue; // Not a CSS selector, return the message directly
  }
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
