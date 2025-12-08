import { createNaviMirror } from "./navi_mirror.js";

export const getMessageFromAttribute = (
  originalElement,
  attributeName,
  generatedMessage,
) => {
  const selectorAttributeName = `${attributeName}-selector`;
  const eventAttributeName = `${attributeName}-event`;
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
  const resolve = () => {
    while (currentStepIndex < resolutionSteps.length) {
      const { element } = resolutionSteps[currentStepIndex];
      if (element) {
        while (currentSubStepIndex < subSteps.length) {
          const subStep = subSteps[currentSubStepIndex];
          currentSubStepIndex++;
          if (subStep === "event") {
            const eventAttribute = element.getAttribute(eventAttributeName);
            if (eventAttribute) {
              return createEventHandler(element, eventAttribute);
            }
          }
          if (subStep === "selector") {
            const selectorAttribute = element.getAttribute(
              selectorAttributeName,
            );
            if (selectorAttribute) {
              return fromSelectorAttribute(selectorAttribute);
            }
          }
          if (subStep === "message") {
            const messageAttribute = element.getAttribute(attributeName);
            if (messageAttribute) {
              return messageAttribute;
            }
          }
        }
      }
      currentStepIndex++;
      currentSubStepIndex = 0;
    }
    return generatedMessage;
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
