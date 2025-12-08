import { createNaviMirror } from "./navi_mirror.js";

export const getMessageFromAttribute = (element, attributeName, message) => {
  const resolver = createMessageResolver(element, attributeName, message);
  return resolver.resolve();
};

const createMessageResolver = (
  originalElement,
  attributeName,
  fallbackMessage,
) => {
  const selectorAttributeName = `${attributeName}-selector`;
  const eventAttributeName = `${attributeName}-event`;

  // Define resolution steps in order of priority
  const resolutionSteps = [
    {
      description: "original element",
      element: originalElement,
    },
    {
      description: "closest fieldset",
      element: originalElement.closest("fieldset"),
    },
    {
      description: "closest form",
      element: originalElement.closest("form"),
    },
  ];
  // Sub-steps for each element (in order of priority)
  const subSteps = ["event", "selector", "message"];
  let currentStepIndex = 0;
  let currentSubStepIndex = 0;
  const resolveSubStep = (element, subStep) => {
    if (!element) {
      return null;
    }

    switch (subStep) {
      case "event": {
        const eventAttribute = element.getAttribute(eventAttributeName);
        if (eventAttribute) {
          return createEventHandler(element, eventAttribute);
        }
        return null;
      }
      case "selector": {
        const selectorAttribute = element.getAttribute(selectorAttributeName);
        if (selectorAttribute) {
          return fromSelectorAttribute(selectorAttribute);
        }
        return null;
      }
      case "message": {
        const messageAttribute = element.getAttribute(attributeName);
        if (messageAttribute) {
          return messageAttribute;
        }
        return null;
      }
      default:
        return null;
    }
  };
  const resolve = () => {
    while (currentStepIndex < resolutionSteps.length) {
      const step = resolutionSteps[currentStepIndex];
      while (currentSubStepIndex < subSteps.length) {
        const subStep = subSteps[currentSubStepIndex];
        const result = resolveSubStep(step.element, subStep);
        if (result) {
          return result;
        }
        currentSubStepIndex++;
      }
      currentStepIndex++;
      currentSubStepIndex = 0;
    }
    return fallbackMessage;
  };

  const createEventHandler = (element, eventName) => {
    return ({ renderIntoCallout }) => {
      element.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            render: (message) => {
              if (message) {
                renderIntoCallout(message);
              } else {
                // Resume resolution from next step
                const nextResult = resolve();
                renderIntoCallout(nextResult);
              }
            },
          },
        }),
      );
    };
  };

  return resolve();
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
