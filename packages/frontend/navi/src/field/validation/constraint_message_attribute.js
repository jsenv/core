import { createNaviMirror } from "./navi_mirror.js";

export const getMessageFromAttribute = (element, attributeName, message) => {
  const selectorAttributeName = `${attributeName}-selector`;
  const eventAttributeName = `${attributeName}-event`;

  const fromAttribute = (element) => {
    if (!element) {
      return null;
    }
    const eventAttribute = element.getAttribute(eventAttributeName);
    if (eventAttribute) {
      return fromEventAttribute(element, eventAttribute, () => {
        // even did not work, we should keep trying to provide a message trying first the selector attribute
        // then the message attribute
        // then trying to reach the closest fieldset or form
        // if nothing works we just return the message
      });
    }
    const selectorAttribute = element.getAttribute(selectorAttributeName);
    if (selectorAttribute) {
      return fromSelectorAttribute(selectorAttribute);
    }
    const messageAttribute = element.getAttribute(attributeName);
    if (messageAttribute) {
      return messageAttribute;
    }
    return null;
  };

  return (
    fromAttribute(element) ||
    fromAttribute(element.closest("fieldset")) ||
    fromAttribute(element.closest("form")) ||
    message
  );
};

const fromEventAttribute = (element, eventName, fallback) => {
  return ({ renderIntoCallout }) => {
    element.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          render: (message) => {
            if (message) {
              renderIntoCallout(message);
            } else {
              renderIntoCallout(fallback());
            }
          },
        },
      }),
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
