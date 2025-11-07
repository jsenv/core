import { createPubSub, createStyleController } from "@jsenv/dom";

export const PSEUDO_CLASSES = {
  ":hover": {
    attribute: "data-hover",
    setup: (el, callback) => {
      el.addEventListener("mouseenter", callback);
      el.addEventListener("mouseleave", callback);
      return () => {
        el.removeEventListener("mouseenter", callback);
        el.removeEventListener("mouseleave", callback);
      };
    },
    test: (el) => el.matches(":hover"),
  },
  ":active": {
    attribute: "data-active",
    setup: (el, callback) => {
      el.addEventListener("mousedown", callback);
      document.addEventListener("mouseup", callback);
      return () => {
        el.removeEventListener("mousedown", callback);
        document.removeEventListener("mouseup", callback);
      };
    },
    test: (el) => el.matches(":active"),
  },
  ":visited": {
    attribute: "data-visited",
  },
  ":checked": {
    attribute: "data-checked",
    setup: (el, callback) => {
      if (el.type === "checkbox") {
        // Listen to user interactions
        el.addEventListener("input", callback);
        // Intercept programmatic changes to .checked property
        const originalDescriptor = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "checked",
        );
        Object.defineProperty(el, "checked", {
          get: originalDescriptor.get,
          set(value) {
            originalDescriptor.set.call(this, value);
            callback();
          },
          configurable: true,
        });
        return () => {
          // Restore original property descriptor
          Object.defineProperty(el, "checked", originalDescriptor);
          el.removeEventListener("input", callback);
        };
      }
      if (el.type === "radio") {
        // Listen to changes on the radio group
        const radioSet =
          el.closest("[data-radio-list], fieldset, form") || document;
        radioSet.addEventListener("input", callback);

        // Intercept programmatic changes to .checked property
        const originalDescriptor = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "checked",
        );
        Object.defineProperty(el, "checked", {
          get: originalDescriptor.get,
          set(value) {
            originalDescriptor.set.call(this, value);
            callback();
          },
          configurable: true,
        });
        return () => {
          radioSet.removeEventListener("input", callback);
          // Restore original property descriptor
          Object.defineProperty(el, "checked", originalDescriptor);
        };
      }
      if (el.tagName === "INPUT") {
        el.addEventListener("input", callback);
        return () => {
          el.removeEventListener("input", callback);
        };
      }
      return () => {};
    },
    test: (el) => el.matches(":checked"),
  },
  ":focus": {
    attribute: "data-focus",
    setup: (el, callback) => {
      el.addEventListener("focusin", callback);
      el.addEventListener("focusout", callback);
      return () => {
        el.removeEventListener("focusin", callback);
        el.removeEventListener("focusout", callback);
      };
    },
    test: (el) => el.matches(":focus"),
  },
  ":focus-visible": {
    attribute: "data-focus-visible",
    setup: (el, callback) => {
      document.addEventListener("keydown", callback);
      document.addEventListener("keyup", callback);
      return () => {
        document.removeEventListener("keydown", callback);
        document.removeEventListener("keyup", callback);
      };
    },
    test: (el) => el.matches(":focus-visible"),
  },
  ":disabled": {
    attribute: "data-disabled",
  },
  ":read-only": {
    attribute: "data-readonly",
  },
  ":valid": {
    attribute: "data-valid",
    test: (el) => el.matches(":valid"),
  },
  ":invalid": {
    attribute: "data-invalid",
    test: (el) => el.matches(":invalid"),
  },
  ":-navi-loading": {
    attribute: "data-loading",
  },
};

export const initPseudoStyles = (
  element,
  {
    pseudoClasses,
    // disabled,
    // readOnly,
    // loading,
    // focusVisible,
    // visited,
    pseudoState,
    effect,
  },
) => {
  if (!pseudoClasses || pseudoClasses.length === 0) {
    effect?.();
    return () => {};
  }

  const [teardown, addTeardown] = createPubSub();

  let state;
  const checkPseudoClasses = () => {
    let someChange = false;
    const currentState = {};
    for (const pseudoClass of pseudoClasses) {
      const pseudoClassDefinition = PSEUDO_CLASSES[pseudoClass];
      let currentValue;
      if (
        pseudoState &&
        Object.hasOwn(pseudoState, pseudoClass) &&
        pseudoState[pseudoClass] !== undefined
      ) {
        currentValue = pseudoState[pseudoClass];
      } else {
        const { test } = pseudoClassDefinition;
        if (test) {
          currentValue = test(element, pseudoState);
        }
      }
      currentState[pseudoClass] = currentValue;
      const oldValue = state ? state[pseudoClass] : undefined;
      if (oldValue !== currentValue) {
        someChange = true;
        const { attribute } = pseudoClassDefinition;
        if (attribute) {
          if (currentValue) {
            element.setAttribute(attribute, "");
          } else {
            element.removeAttribute(attribute);
          }
        }
      }
    }
    if (!someChange) {
      return;
    }
    effect?.(currentState, state);
    state = currentState;
  };

  for (const pseudoClass of pseudoClasses) {
    const pseudoClassDefinition = PSEUDO_CLASSES[pseudoClass];
    if (!pseudoClassDefinition) {
      throw new Error(`Unknown pseudo class: ${pseudoClass}`);
    }
    const { setup } = pseudoClassDefinition;
    if (setup) {
      const cleanup = setup(element, () => {
        checkPseudoClasses();
      });
      addTeardown(cleanup);
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
// by creating the style controller after the navi one we ensure it overrides (animation played on top of each other)
const naviStyleController = createStyleController("navi");
const pseudoStateStyleController = createStyleController("navi_pseudo_state");
const pseudoElementStyleController = createStyleController(
  "navi_pseudo_element",
);
export const applyStyles = (element, style) => {
  naviStyleController.set(element, style);
};
export const applyPseudoStyles = (element, pseudoStates, pseudoStyles) => {
  if (!pseudoStyles) {
    return;
  }
  for (const pseudoName of Object.keys(pseudoStyles)) {
    const stylesToApply = pseudoStyles[pseudoName];
    if (pseudoName.startsWith("::")) {
      pseudoElementStyleController.set(element, stylesToApply);
      continue;
    }
    const shouldApply = pseudoStates[pseudoName];
    if (shouldApply) {
      pseudoStateStyleController.set(element, stylesToApply);
    } else {
      pseudoStateStyleController.clear(element);
    }
  }
};
