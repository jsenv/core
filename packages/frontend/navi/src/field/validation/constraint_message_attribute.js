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

  const mirror = createElementMirror(messageSourceElement);
  return mirror;
};

const createElementMirror = (sourceElement) => {
  const cloneElement = sourceElement.cloneNode(true);

  // Set up mutation observer to sync changes from source to cloned element
  const mutationObserver = new MutationObserver(() => {
    // Replace the current clone's content
    cloneElement.innerHTML = sourceElement.innerHTML;
    // Copy attributes
    for (const attr of Array.from(sourceElement.attributes)) {
      cloneElement.setAttribute(attr.name, attr.value);
    }
  });
  mutationObserver.observe(sourceElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  return cloneElement;
};
