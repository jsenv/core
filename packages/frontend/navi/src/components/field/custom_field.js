import { createPubSub } from "@jsenv/dom";

export const initCustomField = (
  customField,
  field,
  { effect, skipFocus } = {},
) => {
  const [teardown, addTeardown] = createPubSub();

  const addEventListener = (element, eventType, listener) => {
    element.addEventListener(eventType, listener);
    return addTeardown(() => {
      element.removeEventListener(eventType, listener);
    });
  };
  let state;
  const applyStateOnAttribute = (value, key) => {
    const attributeName =
      key === "focusVisible" ? "data-focus-visible" : `data-${key}`;
    if (value) {
      customField.setAttribute(attributeName, "");
    } else {
      customField.removeAttribute(attributeName);
    }
  };
  const checkPseudoClasses = () => {
    const hover = field.matches(":hover");
    const active = field.matches(":active");
    const checked = field.matches(":checked");
    const valid = field.matches(":valid");
    const invalid = field.matches(":invalid");
    const focus = field.matches(":focus");
    const focusVisible = field.matches(":focus-visible");
    const newState = {
      hover,
      active,
      checked,
      valid,
      invalid,
      focus,
      focusVisible,
    };
    let someChange = false;
    for (const key of Object.keys(newState)) {
      if (!state || newState[key] !== state[key]) {
        if (!skipFocus || !key.includes("focus")) {
          applyStateOnAttribute(newState[key], key);
        }

        someChange = true;
      }
    }
    if (!someChange) {
      return;
    }
    effect?.(newState, state);
    state = newState;
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
  } else if (field.type === "radio") {
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
  } else if (field.tagName === "INPUT") {
    addEventListener(field, "input", checkPseudoClasses);
  }

  checkPseudoClasses();
  // just in case + catch use forcing them in chrome devtools
  const interval = setInterval(() => {
    checkPseudoClasses();
  }, 150);
  addTeardown(() => {
    clearInterval(interval);
  });

  return teardown;
};
