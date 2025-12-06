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
    test: (el) => {
      if (el.matches(":focus")) {
        return true;
      }
      const focusProxy = el.getAttribute("focus-proxy");
      if (focusProxy) {
        return document.querySelector(`#${focusProxy}`).matches(":focus");
      }
      return false;
    },
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
    test: (el) => {
      if (el.matches(":focus-visible")) {
        return true;
      }
      const focusProxy = el.getAttribute("focus-proxy");
      if (focusProxy) {
        return document
          .querySelector(`#${focusProxy}`)
          .matches(":focus-visible");
      }
      return false;
    },
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
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        if (el.type === "checkbox" || el.type === "radio") {
          // there is no readOnly for checkboxes/radios
          return;
        }
        el.readOnly = true;
      }
    },
    remove: (el) => {
      if (
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        if (el.type === "checkbox" || el.type === "radio") {
          // there is no readOnly for checkboxes/radios
          return;
        }
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
  ":-navi-status-info": {
    attribute: "data-status-info",
  },
  ":-navi-status-success": {
    attribute: "data-status-success",
  },
  ":-navi-status-warning": {
    attribute: "data-status-warning",
  },
  ":-navi-status-error": {
    attribute: "data-status-error",
  },
};

const NAVI_PSEUDO_STATE_CUSTOM_EVENT = "navi_pseudo_state";
const dispatchNaviPseudoStateEvent = (element, value, oldValue) => {
  if (!element) {
    return;
  }
  element.dispatchEvent(
    new CustomEvent(NAVI_PSEUDO_STATE_CUSTOM_EVENT, {
      detail: {
        pseudoState: value,
        oldPseudoState: oldValue,
      },
    }),
  );
};

const EMPTY_STATE = {};
export const initPseudoStyles = (
  element,
  {
    pseudoClasses,
    pseudoState, // ":disabled", ":read-only", ":-navi-loading", etc...
    effect,
    elementToImpact = element,
    elementListeningPseudoState,
  },
) => {
  if (elementListeningPseudoState === element) {
    console.warn(
      `elementListeningPseudoState should not be the same as element to avoid infinite loop`,
    );
    elementListeningPseudoState = null;
  }

  const onStateChange = (value, oldValue) => {
    effect?.(value, oldValue);
    if (elementListeningPseudoState) {
      dispatchNaviPseudoStateEvent(
        elementListeningPseudoState,
        value,
        oldValue,
      );
    }
  };

  if (!pseudoClasses || pseudoClasses.length === 0) {
    onStateChange(EMPTY_STATE);
    return () => {};
  }

  const [teardown, addTeardown] = createPubSub();

  let state;
  const checkPseudoClasses = () => {
    let someChange = false;
    const currentState = {};
    for (const pseudoClass of pseudoClasses) {
      const pseudoClassDefinition = PSEUDO_CLASSES[pseudoClass];
      if (!pseudoClassDefinition) {
        console.warn(`Unknown pseudo class: ${pseudoClass}`);
        continue;
      }
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
      if (oldValue !== currentValue || !state) {
        someChange = true;
        const { attribute, add, remove } = pseudoClassDefinition;
        if (currentValue) {
          if (attribute) {
            elementToImpact.setAttribute(attribute, "");
          }
          add?.(element);
        } else {
          if (attribute) {
            elementToImpact.removeAttribute(attribute);
          }
          remove?.(element);
        }
      }
    }
    if (!someChange) {
      return;
    }
    const oldState = state;
    state = currentState;
    onStateChange(state, oldState);
  };

  element.addEventListener(NAVI_PSEUDO_STATE_CUSTOM_EVENT, (event) => {
    const oldState = event.detail.oldPseudoState;
    state = event.detail.pseudoState;
    onStateChange(state, oldState);
  });

  for (const pseudoClass of pseudoClasses) {
    const pseudoClassDefinition = PSEUDO_CLASSES[pseudoClass];
    if (!pseudoClassDefinition) {
      console.warn(`Unknown pseudo class: ${pseudoClass}`);
      continue;
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

export const applyStyle = (element, style, pseudoState, pseudoNamedStyles) => {
  if (!element) {
    return;
  }
  const styleToApply = getStyleToApply(style, pseudoState, pseudoNamedStyles);
  updateStyle(element, styleToApply);
};

export const PSEUDO_STATE_DEFAULT = {};
export const PSEUDO_NAMED_STYLES_DEFAULT = {};
const getStyleToApply = (styles, pseudoState, pseudoNamedStyles) => {
  if (
    !pseudoState ||
    pseudoState === PSEUDO_STATE_DEFAULT ||
    !pseudoNamedStyles ||
    pseudoNamedStyles === PSEUDO_NAMED_STYLES_DEFAULT
  ) {
    return styles;
  }

  const isMatching = (pseudoKey) => {
    if (pseudoKey.startsWith("::")) {
      const nextColonIndex = pseudoKey.indexOf(":", 2);
      if (nextColonIndex === -1) {
        return true;
      }
      // Handle pseudo-elements with states like "::-navi-loader:checked:disabled"
      const pseudoStatesString = pseudoKey.slice(nextColonIndex);
      return isMatching(pseudoStatesString);
    }
    const nextColonIndex = pseudoKey.indexOf(":", 1);
    if (nextColonIndex === -1) {
      return pseudoState[pseudoKey];
    }
    // Handle compound pseudo-states like ":checked:disabled"
    return pseudoKey
      .slice(1)
      .split(":")
      .every((state) => pseudoState[state]);
  };

  const styleToAddSet = new Set();
  for (const pseudoKey of Object.keys(pseudoNamedStyles)) {
    if (isMatching(pseudoKey)) {
      const stylesToApply = pseudoNamedStyles[pseudoKey];
      styleToAddSet.add(stylesToApply);
    }
  }
  if (styleToAddSet.size === 0) {
    return styles;
  }
  let style = styles || {};
  for (const styleToAdd of styleToAddSet) {
    style = mergeTwoStyles(style, styleToAdd, "css");
  }
  return style;
};

const styleKeySetWeakMap = new WeakMap();
const elementTransitionStateWeakMap = new WeakMap();
const NO_STYLE_KEY_SET = new Set();

const updateStyle = (element, style) => {
  const styleKeySet = style ? new Set(Object.keys(style)) : NO_STYLE_KEY_SET;
  const oldStyleKeySet = styleKeySetWeakMap.get(element) || NO_STYLE_KEY_SET;
  const hasTransition = styleKeySet.has("transition");
  let transitionState = elementTransitionStateWeakMap.get(element);

  if (hasTransition || transitionState) {
    if (!transitionState) {
      transitionState = { hasBeenUpdatedThisFrame: false, rafId: null };
      elementTransitionStateWeakMap.set(element, transitionState);
    }
    // Cancel previous transition restoration and disable transitions on first update
    if (transitionState.rafId !== null) {
      cancelAnimationFrame(transitionState.rafId);
    }
    if (!transitionState.hasBeenUpdatedThisFrame) {
      transitionState.hasBeenUpdatedThisFrame = true;
      element.style.transition = "none";
    }
  }

  // Apply styles (excluding transition)
  const keysToDelete = new Set(oldStyleKeySet);
  for (const key of styleKeySet) {
    if (key === "transition") continue;

    keysToDelete.delete(key);
    const value = style[key];
    if (key.startsWith("--")) {
      element.style.setProperty(key, value);
    } else {
      element.style[key] = value;
    }
  }
  // Remove obsolete styles (excluding transition)
  for (const key of keysToDelete) {
    if (key === "transition") continue;

    if (key.startsWith("--")) {
      element.style.removeProperty(key);
    } else {
      element.style[key] = "";
    }
  }
  styleKeySetWeakMap.set(element, styleKeySet);

  // Schedule transition restoration
  if (transitionState) {
    transitionState.rafId = requestAnimationFrame(() => {
      transitionState.hasBeenUpdatedThisFrame = false;
      transitionState.rafId = null;

      element.style.transition = hasTransition ? style.transition : "";
    });
  }
};
