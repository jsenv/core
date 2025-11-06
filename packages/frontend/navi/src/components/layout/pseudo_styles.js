import { createPubSub } from "@jsenv/dom";

export const initPseudoStyles = (
  element,
  { readOnly, disabled, loading, focusVisible },
  { elementReceivingAttributes = element, effect } = {},
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
      elementReceivingAttributes.setAttribute(attributeName, "");
    } else {
      elementReceivingAttributes.removeAttribute(attributeName);
    }
  };
  const checkPseudoClasses = () => {
    const newState = {
      ":hover": element.matches(":hover"),
      ":active": element.matches(":active"),
      ":checked": element.matches(":checked"),
      ":focus": element.matches(":focus"),
      ":focus-visible": element.matches(":focus-visible") || focusVisible,
      ":disabled": disabled,
      ":readonly": readOnly,
      ":valid": element.matches(":valid"),
      ":invalid": element.matches(":invalid"),
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
  addEventListener(element, "mouseenter", checkPseudoClasses);
  addEventListener(element, "mouseleave", checkPseudoClasses);
  // :active
  addEventListener(element, "mousedown", checkPseudoClasses);
  addEventListener(document, "mouseup", checkPseudoClasses);
  // :focus
  addEventListener(element, "focusin", checkPseudoClasses);
  addEventListener(element, "focusout", checkPseudoClasses);
  // :focus-visible
  addEventListener(document, "keydown", checkPseudoClasses);
  addEventListener(document, "keyup", checkPseudoClasses);
  checked: {
    if (element.type === "checkbox") {
      // Listen to user interactions
      addEventListener(element, "input", checkPseudoClasses);

      // Intercept programmatic changes to .checked property
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked",
      );
      Object.defineProperty(element, "checked", {
        get: originalDescriptor.get,
        set(value) {
          originalDescriptor.set.call(this, value);
          checkPseudoClasses();
        },
        configurable: true,
      });
      addTeardown(() => {
        // Restore original property descriptor
        Object.defineProperty(element, "checked", originalDescriptor);
      });
    } else if (element.type === "radio") {
      // Listen to changes on the radio group
      const radioSet =
        element.closest("[data-radio-list], fieldset, form") || document;
      addEventListener(radioSet, "input", checkPseudoClasses);

      // Intercept programmatic changes to .checked property
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked",
      );
      Object.defineProperty(element, "checked", {
        get: originalDescriptor.get,
        set(value) {
          originalDescriptor.set.call(this, value);
          checkPseudoClasses();
        },
        configurable: true,
      });
      addTeardown(() => {
        // Restore original property descriptor
        Object.defineProperty(element, "checked", originalDescriptor);
      });
    } else if (element.tagName === "INPUT") {
      addEventListener(element, "input", checkPseudoClasses);
    }
  }

  checkPseudoClasses();
  // just in case + catch use forcing them in chrome devtools
  const interval = setInterval(() => {
    checkPseudoClasses();
  }, 300);
  addTeardown(() => {
    clearInterval(interval);
  });

  return teardown;
};
