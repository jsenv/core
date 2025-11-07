import { createPubSub, mergeTwoStyles } from "@jsenv/dom";

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
    add: (el) => {
      if (
        el.tagName === "BUTTON" ||
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        el.disabled = true;
      }
    },
    remove: (el) => {
      if (
        el.tagName === "BUTTON" ||
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        el.disabled = false;
      }
    },
  },
  ":read-only": {
    attribute: "data-readonly",
    add: (el) => {
      if (
        el.tagName === "BUTTON" ||
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        el.readOnly = true;
      }
    },
    remove: (el) => {
      if (
        el.tagName === "BUTTON" ||
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        el.readOnly = false;
      }
    },
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
        const { attribute, add, remove } = pseudoClassDefinition;
        if (currentValue) {
          if (attribute) {
            element.setAttribute(attribute, "");
          }
          add?.(element);
        } else {
          if (attribute) {
            element.removeAttribute(attribute);
          }

          remove?.(element);
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

export const applyStyle = (element, style, pseudoState, pseudoStyles) => {
  if (!element) {
    return;
  }
  updateStyle(element, getStyleToApply(style, pseudoState, pseudoStyles));
};

const getStyleToApply = (styles, pseudoState, pseudoStyles) => {
  if (!pseudoState || !pseudoStyles) {
    return styles;
  }

  const styleToAddSet = new Set();
  for (const pseudoName of Object.keys(pseudoStyles)) {
    const stylesToApply = pseudoStyles[pseudoName];
    if (pseudoName.startsWith("::")) {
      styleToAddSet.add(stylesToApply);
      continue;
    }
    const shouldApply = pseudoState[pseudoName];
    if (!shouldApply) {
      continue;
    }
    styleToAddSet.add(stylesToApply);
  }
  if (styleToAddSet.size === 0) {
    return styles;
  }
  let style = styles;
  for (const styleToAdd of styleToAddSet) {
    style = mergeTwoStyles(style, styleToAdd);
  }
  return style;
};

const styleKeySetWeakMap = new WeakMap();
const updateStyle = (element, style) => {
  const previousStyleKeySet = styleKeySetWeakMap.get(element);
  const styleKeySet = new Set(Object.keys(style));
  if (!previousStyleKeySet) {
    for (const key of styleKeySet) {
      if (key.startsWith("--")) {
        element.style.setProperty(key, style[key]);
      } else {
        element.style[key] = style[key];
      }
    }
    styleKeySetWeakMap.set(element, styleKeySet);
    return;
  }
  const toDeleteKeySet = new Set(previousStyleKeySet);
  for (const key of styleKeySet) {
    toDeleteKeySet.delete(key);
    if (key.startsWith("--")) {
      element.style.setProperty(key, style[key]);
    } else {
      element.style[key] = style[key];
    }
  }
  for (const toDeleteKey of toDeleteKeySet) {
    element.style.removeProperty(toDeleteKey);
  }
  styleKeySetWeakMap.set(element, styleKeySet);
  return;
};
