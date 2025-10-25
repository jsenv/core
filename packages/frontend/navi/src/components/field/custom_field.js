import { createPubSub } from "@jsenv/dom";

export const initCustomField = (customField, field) => {
  const [teardown, addTeardown] = createPubSub();

  const addEventListener = (element, eventType, listener) => {
    element.addEventListener(eventType, listener);
    return addTeardown(() => {
      element.removeEventListener(eventType, listener);
    });
  };
  const updateBooleanAttribute = (attributeName, isPresent) => {
    if (isPresent) {
      customField.setAttribute(attributeName, "");
    } else {
      customField.removeAttribute(attributeName);
    }
  };
  const checkPseudoClasses = () => {
    const hover = field.matches(":hover");
    const active = field.matches(":active");
    const checked = field.matches(":checked");
    const focus = field.matches(":focus");
    const focusVisible = field.matches(":focus-visible");
    updateBooleanAttribute(`data-hover`, hover);
    updateBooleanAttribute(`data-active`, active);
    updateBooleanAttribute(`data-checked`, checked);
    updateBooleanAttribute(`data-focus`, focus);
    updateBooleanAttribute(`data-focus-visible`, focusVisible);
  };

  // :hover
  addEventListener(field, "mouseenter", checkPseudoClasses);
  addEventListener(field, "mouseleave", checkPseudoClasses);
  // :active
  addEventListener(field, "mousedown", checkPseudoClasses);
  addEventListener(document, "mouseup", checkPseudoClasses);
  // :focus
  addEventListener(field, "focusin", checkPseudoClasses);
  addEventListener(field, "focusout", checkPseudoClasses);
  // :focus-visible
  addEventListener(document, "keydown", checkPseudoClasses);
  addEventListener(document, "keyup", checkPseudoClasses);
  // :checked
  if (field.type === "checkbox") {
    // Listen to user interactions
    addEventListener(field, "input", checkPseudoClasses);

    // Intercept programmatic changes to .checked property
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "checked",
    );
    Object.defineProperty(field, "checked", {
      get: originalDescriptor.get,
      set(value) {
        originalDescriptor.set.call(this, value);
        checkPseudoClasses();
      },
      configurable: true,
    });
    addTeardown(() => {
      // Restore original property descriptor
      Object.defineProperty(field, "checked", originalDescriptor);
    });
  }
  if (field.type === "radio") {
    // Listen to changes on the radio group
    const radioSet =
      field.closest("[data-radio-list], fieldset, form") || document;
    addEventListener(radioSet, "input", checkPseudoClasses);

    // Intercept programmatic changes to .checked property
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "checked",
    );
    Object.defineProperty(field, "checked", {
      get: originalDescriptor.get,
      set(value) {
        originalDescriptor.set.call(this, value);
        checkPseudoClasses();
      },
      configurable: true,
    });
    addTeardown(() => {
      // Restore original property descriptor
      Object.defineProperty(field, "checked", originalDescriptor);
    });
  }

  // just in case + catch use forcing them in chrome devtools
  const interval = setInterval(() => {
    checkPseudoClasses();
  }, 150);
  addTeardown(() => {
    clearInterval(interval);
  });

  return teardown;
};
