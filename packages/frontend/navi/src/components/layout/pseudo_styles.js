import { createPubSub, createStyleController } from "@jsenv/dom";

const PSEUDO_CLASSES = {
  ":hover": {
    setup: (el, callback) => {
      el.addEventListener("mouseenter", callback);
      el.addEventListener("mouseleave", callback);
      return () => {
        el.removeEventListener("mouseenter", callback);
        el.removeEventListener("mouseleave", callback);
      };
    },
    test: (el) => el.matches(":hover"),
    add: (el) => {
      el.setAttribute("data-hover", "");
    },
    remove: (el) => {
      el.removeAttribute("data-hover");
    },
  },
  ":active": {
    setup: (el, callback) => {
      el.addEventListener("mousedown", callback);
      document.addEventListener("mouseup", callback);
      return () => {
        el.removeEventListener("mousedown", callback);
        document.removeEventListener("mouseup", callback);
      };
    },
    test: (el) => el.matches(":active"),
    add: (el) => {
      el.setAttribute("data-active", "");
    },
    remove: (el) => {
      el.removeAttribute("data-active");
    },
  },
  ":checked": {
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
    add: (el) => {
      el.setAttribute("data-checked", "");
    },
    remove: (el) => {
      el.removeAttribute("data-checked");
    },
  },
  ":focus": {
    setup: (el, callback) => {
      el.addEventListener("focusin", callback);
      el.addEventListener("focusout", callback);
      return () => {
        el.removeEventListener("focusin", callback);
        el.removeEventListener("focusout", callback);
      };
    },
    test: (el) => el.matches(":focus"),
    add: (el) => {
      el.setAttribute("data-focus", "");
    },
    remove: (el) => {
      el.removeAttribute("data-focus");
    },
  },
  ":focus-visible": {
    setup: (el, callback) => {
      document.addEventListener("keydown", callback);
      document.addEventListener("keyup", callback);
      return () => {
        document.removeEventListener("keydown", callback);
        document.removeEventListener("keyup", callback);
      };
    },
    test: (el, props) => el.matches(":focus-visible") || props.focusVisible,
    add: (el) => {
      el.setAttribute("data-focus-visible", "");
    },
    remove: (el) => {
      el.removeAttribute("data-focus-visible");
    },
  },
  ":disabled": {
    test: (el, props) => props.disabled,
    add: (el) => {
      el.setAttribute("data-disabled", "");
    },
    remove: (el) => {
      el.removeAttribute("data-disabled");
    },
  },
  ":read-only": {
    test: (el, props) => props.readOnly,
    add: (el) => {
      el.setAttribute("data-readonly", "");
    },
    remove: (el) => {
      el.removeAttribute("data-readonly");
    },
  },
  ":valid": {
    test: (el) => el.matches(":valid"),
    add: (el) => {
      el.setAttribute("data-valid", "");
    },
    remove: (el) => {
      el.removeAttribute("data-valid");
    },
  },
  ":invalid": {
    test: (el) => el.matches(":invalid"),
    add: (el) => {
      el.setAttribute("data-invalid", "");
    },
    remove: (el) => {
      el.removeAttribute("data-invalid");
    },
  },
  ":-navi-loading": {
    test: (el, props) => props.loading,
    add: (el) => {
      el.setAttribute("data-loading", "");
    },
    remove: (el) => {
      el.removeAttribute("data-loading");
    },
  },
};

export const initPseudoStyles = (
  element,
  { pseudoClasses, readOnly, disabled, loading, focusVisible },
  { effect } = {},
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
      const currentValue = pseudoClassDefinition.test(element, {
        disabled,
        readOnly,
        loading,
        focusVisible,
      });
      currentState[pseudoClass] = currentValue;
      const oldValue = state ? state[pseudoClass] : undefined;
      if (oldValue !== currentValue) {
        someChange = true;
        if (currentValue) {
          pseudoClassDefinition.add(element);
        } else {
          pseudoClassDefinition.remove(element);
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
const naviStyleController = createStyleController("navi");
// by creating the style controller after the navi one we ensure it overrides (animation played on top of each other)
const pseudoStyleControllers = {
  ":hover": createStyleController("navi:hover"),
  ":active": createStyleController("navi:active"),
  ":checked": createStyleController("navi:checked"),
  ":disabled": createStyleController("navi:disabled"),
  ":focus": createStyleController("navi:focus"),
  ":focus-visible": createStyleController("navi:focus-visible"),
  ":valid": createStyleController("navi:valid"),
  ":invalid": createStyleController("navi:invalid"),
  ":read-only": createStyleController("navi:read-only"),
  ":visited": createStyleController("navi:visited"),
  "::-navi-loader": createStyleController("navi::-navi-loader"),
};
export const applyStyles = (element, style) => {
  naviStyleController.set(element, style);
};
export const applyPseudoStyles = (element, pseudoStates, pseudoStyles) => {
  if (!pseudoStyles) {
    return;
  }
  for (const pseudoName of Object.keys(pseudoStyles)) {
    const stylesToApply = pseudoStyles[pseudoName];
    const pseudoStyleController = pseudoStyleControllers[pseudoName];
    if (pseudoName.startsWith("::")) {
      pseudoStyleController.set(element, stylesToApply);
      continue;
    }
    const shouldApply = pseudoStates[pseudoName];
    if (shouldApply) {
      pseudoStyleController.set(element, stylesToApply);
    } else {
      pseudoStyleController.clear(element);
    }
  }
};
