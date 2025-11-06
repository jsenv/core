import { createPubSub } from "@jsenv/dom";

export const initCustomField = (
  customField,
  field,
  { focusVisible, readOnly, loading, disabled, effect } = {},
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
      key === ":focus-visible"
        ? "data-focus-visible"
        : key === ":-navi-loading"
          ? "data-loading"
          : `data-${key.slice(1)}`;
    if (value) {
      customField.setAttribute(attributeName, "");
    } else {
      customField.removeAttribute(attributeName);
    }
  };
  const checkPseudoClasses = () => {
    const newState = {
      ":hover": field.matches(":hover"),
      ":active": field.matches(":active"),
      ":checked": field.matches(":checked"),
      ":focus": field.matches(":focus"),
      ":focus-visible": field.matches(":focus-visible") || focusVisible,
      ":disabled": disabled,
      ":readonly": readOnly,
      ":valid": field.matches(":valid"),
      ":invalid": field.matches(":invalid"),
      ":-navi-loading": loading,
    };
    let someChange = false;
    for (const key of Object.keys(newState)) {
      if (!state || newState[key] !== state[key]) {
        applyStateOnAttribute(newState[key], key);
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
