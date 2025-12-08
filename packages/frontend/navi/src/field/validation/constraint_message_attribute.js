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
    // Step 1: Original element
    {
      element: originalElement,
      description: "original element",
    },
    // Step 2: Closest fieldset
    {
      element: originalElement.closest("fieldset"),
      description: "closest fieldset",
    },
    // Step 3: Closest form
    {
      element: originalElement.closest("form"),
      description: "closest form",
    },
    // Step 4: Fallback message
    {
      element: null,
      description: "fallback message",
    },
  ];
  let currentStepIndex = 0;
  const resolveFromElement = (element) => {
    if (!element) {
      return null;
    }
    // Check for event attribute first (highest priority)
    const eventAttribute = element.getAttribute(eventAttributeName);
    if (eventAttribute) {
      return createEventHandler(element, eventAttribute);
    }
    // Check for selector attribute
    const selectorAttribute = element.getAttribute(selectorAttributeName);
    if (selectorAttribute) {
      return fromSelectorAttribute(selectorAttribute);
    }
    // Check for message attribute
    const messageAttribute = element.getAttribute(attributeName);
    if (messageAttribute) {
      return messageAttribute;
    }
    return null;
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
                const nextResult = resumeResolution();
                renderIntoCallout(nextResult);
              }
            },
          },
        }),
      );
    };
  };

  const resumeResolution = () => {
    // Continue from the next step
    currentStepIndex++;

    for (let i = currentStepIndex; i < resolutionSteps.length; i++) {
      const step = resolutionSteps[i];
      currentStepIndex = i;

      if (step.element === null) {
        // Reached fallback message step
        return fallbackMessage;
      }

      const result = resolveFromElement(step.element);
      if (result) {
        return result;
      }
    }

    // If we get here, return fallback message
    return fallbackMessage;
  };

  return {
    resolve: () => {
      currentStepIndex = 0;

      for (let i = 0; i < resolutionSteps.length; i++) {
        const step = resolutionSteps[i];
        currentStepIndex = i;

        if (step.element === null) {
          // Reached fallback message step
          return fallbackMessage;
        }

        const result = resolveFromElement(step.element);
        if (result) {
          return result;
        }
      }

      // Fallback
      return fallbackMessage;
    },
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
