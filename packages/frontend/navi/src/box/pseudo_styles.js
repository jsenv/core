import {
  createPubSub,
  dispatchInternalCustomEvent,
  mergeTwoStyles,
} from "@jsenv/dom";

import { listenInputValue } from "../field/input/input_value_listener.js";

const requestPseudoStateCheck = (element, detail) => {
  dispatchInternalCustomEvent(
    element,
    "navi_pseudo_state_request_check",
    detail,
  );
};
export const NAVI_PSEUDO_STATE_CUSTOM_EVENT = "navi_pseudo_state";
const dispatchPseudoStateCustomEvent = (element, value, oldValue) => {
  dispatchInternalCustomEvent(element, NAVI_PSEUDO_STATE_CUSTOM_EVENT, {
    pseudoState: value,
    oldPseudoState: oldValue,
  });
};

export const PSEUDO_CLASSES = {};
Object.assign(PSEUDO_CLASSES, {
  ":valid": {
    attribute: "data-valid",
    test: (el) => el.matches(":valid"),
  },
  ":invalid": {
    attribute: "data-invalid",
    test: (el) => el.matches(":invalid"),
  },
  ":visited": {
    attribute: "data-visited",
  },
});
const definePseudoClass = (pseudoClass, definition) => {
  PSEUDO_CLASSES[pseudoClass] = definition;
};

definePseudoClass(":hover", {
  attribute: "data-hover",
  setup: (el, callback) => {
    let onmouseenter = () => {
      callback();
    };
    let onmouseleave = () => {
      callback();
    };

    if (el.tagName === "LABEL") {
      // input.matches(":hover") is true when hovering the label
      // so when label is hovered/not hovered we need to recheck the input too
      const recheckInput = (e) => {
        if (el.htmlFor) {
          const input = document.getElementById(el.htmlFor);
          if (!input) {
            // cannot find the input for this label in the DOM
            return;
          }
          requestPseudoStateCheck(input, { event: e });
          return;
        }
        const input = el.querySelector("input, textarea, select");
        if (!input) {
          // label does not contain an input
          return;
        }
        requestPseudoStateCheck(input, { event: e });
      };
      onmouseenter = (e) => {
        callback();
        recheckInput(e);
      };
      onmouseleave = (e) => {
        callback();
        recheckInput(e);
      };
    }

    el.addEventListener("mouseenter", onmouseenter);
    el.addEventListener("mouseleave", onmouseleave);
    return () => {
      el.removeEventListener("mouseenter", onmouseenter);
      el.removeEventListener("mouseleave", onmouseleave);
    };
  },
  test: (el) => el.matches(":hover"),
});
definePseudoClass(":disabled", {
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
});
definePseudoClass(":read-only", {
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
});
definePseudoClass(":checked", {
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
});
definePseudoClass(":active", {
  attribute: "data-active",
  setup: (el, callback) => {
    // I'ts recommended to use :-navi-pressed over :active for interactive elements.
    const onPointerDown = () => {
      const onRelease = () => {
        document.removeEventListener("pointercancel", onRelease, true);
        document.removeEventListener("pointerup", onRelease, true);
        callback();
      };
      document.addEventListener("pointercancel", onRelease, true);
      document.addEventListener("pointerup", onRelease, true);
      callback();
    };
    el.addEventListener("pointerdown", onPointerDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
    };
  },
  test: (el) => el.matches(":active"),
});
focus_classes: {
  // We implement :focus and :focus-visible with enriched semantics:
  // an element is considered focused not only when it natively has focus, but also
  // when a "focus proxy" element has focus (e.g. a read-only range input delegates
  // focus to a sibling span) or when a controlling element has focus (e.g. a combobox
  // input with aria-controls pointing to a listbox — the listbox should appear focused
  // while the input is focused).
  //
  // We intentionally reuse the native :focus / :focus-visible names rather than
  // introducing new navi-specific pseudo-classes (e.g. :-navi-focus). This is a
  // deliberate exception: all existing CSS and code written as [data-focus] or
  // [data-focus-visible] automatically benefits from the enriched behavior without
  // any changes. A separate navi-specific class would require updating every
  // component.
  //
  // When a controller element (e.g. combobox input) gains or loses focus,
  // notify the elements it controls via aria-controls so they re-check their focus state.
  const notifyAriaControlled = (el, e) => {
    const controlledIds = el.getAttribute("aria-controls");
    if (!controlledIds) {
      return;
    }
    for (const id of controlledIds.split(" ")) {
      const controlled = document.getElementById(id);
      if (controlled) {
        requestPseudoStateCheck(controlled, { event: e });
      }
    }
  };
  // Check if any element whose aria-controls includes el's id currently has focus.
  const isControlledByFocusedElement = (
    el,
    { requireFocusVisible = false } = {},
  ) => {
    const id = el.id;
    if (!id) {
      return false;
    }
    const controllers = document.querySelectorAll(`[aria-controls~="${id}"]`);
    for (const controller of controllers) {
      // If the controller is inside the element it controls, the element already
      // receives native :focus/:focus-within — no need to inherit focus from it.
      if (el.contains(controller)) {
        continue;
      }
      const pseudoClass = requireFocusVisible ? ":focus-visible" : ":focus";
      if (controller.matches(pseudoClass)) {
        return true;
      }
    }
    return false;
  };

  definePseudoClass(":focus", {
    attribute: "data-focus",
    setup: (el, callback) => {
      const onFocusChange = (e) => {
        callback();
        notifyAriaControlled(el, e);
      };
      el.addEventListener("focusin", onFocusChange);
      el.addEventListener("focusout", onFocusChange);
      return () => {
        el.removeEventListener("focusin", onFocusChange);
        el.removeEventListener("focusout", onFocusChange);
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
      if (isControlledByFocusedElement(el)) {
        return true;
      }
      return false;
    },
  });
  definePseudoClass(":focus-visible", {
    attribute: "data-focus-visible",
    setup: (el, callback) => {
      const onFocusChange = (e) => {
        callback();
        notifyAriaControlled(el, e);
      };
      document.addEventListener("keydown", callback);
      document.addEventListener("keyup", callback);
      el.addEventListener("focusin", onFocusChange);
      el.addEventListener("focusout", onFocusChange);
      return () => {
        document.removeEventListener("keydown", callback);
        document.removeEventListener("keyup", callback);
        el.removeEventListener("focusin", onFocusChange);
        el.removeEventListener("focusout", onFocusChange);
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
      if (isControlledByFocusedElement(el, { requireFocusVisible: true })) {
        return true;
      }
      return false;
    },
  });
  definePseudoClass(":focus-within", {
    attribute: "data-focus-within",
    setup: (el, callback) => {
      const onFocusChange = (e) => {
        callback();
        notifyAriaControlled(el, e);
      };
      el.addEventListener("focusin", onFocusChange);
      el.addEventListener("focusout", onFocusChange);
      return () => {
        el.removeEventListener("focusin", onFocusChange);
        el.removeEventListener("focusout", onFocusChange);
      };
    },
    test: (el) => {
      if (el.matches(":focus-within")) {
        return true;
      }
      if (isControlledByFocusedElement(el)) {
        return true;
      }
      if (el.contains(document.activeElement)) {
        // for some reason :focus-within sometimes is false while focus is within...
        // (popover with chrome for some reason)
        return true;
      }
      return false;
    },
  });
}

Object.assign(PSEUDO_CLASSES, {
  ":-navi-pointed": {
    attribute: "data-pointed",
  },
  ":-navi-pointed-by-mouse": {
    attribute: "data-pointed-by-mouse",
  },
  ":-navi-pointed-by-keyboard": {
    attribute: "data-pointed-by-keyboard",
  },
  ":-navi-pointed-by-proxy": {
    attribute: "data-pointed-by-proxy",
  },
  ":-navi-selected": {
    attribute: "data-selected",
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
  ":-navi-expanded": {
    attribute: "data-expanded",
  },
  ":-navi-void": {
    attribute: "data-void",
  },
  "::highlight": {},
});
definePseudoClass(":-navi-has-value", {
  attribute: "data-has-value",
  setup: (el, callback) => {
    return listenInputValue(el, callback);
  },
  test: (el) => {
    if (el.value === "") {
      return false;
    }
    return true;
  },
});
navi_pressed: {
  const pressedElements = new WeakSet();
  definePseudoClass(":-navi-pressed", {
    attribute: "data-pressed",
    setup: (el, callback) => {
      // Prefer :-navi-pressed over :active for interactive elements because:
      // - :active only tracks the primary (left) button; right-click and touch
      //   long-press do not trigger :active reliably across browsers.
      // - :-navi-pressed explicitly ignores non-primary buttons (e.g. right-click)
      //   and correctly clears pressed state when a context menu opens on long-press,
      //   which would otherwise leave the element stuck in a pressed appearance.

      // Note: it might be tempting to use el.setPointerCapture() here so that pointerup
      // always fires on el regardless of where the pointer is released. However,
      // pointer capture routes all subsequent pointer events to the capturing element,
      // which means any other element in the tree that expects to receive pointerup,
      // mouseup, click, etc. after a pointerdown will silently not get them.
      // For example a <label> that reacts to mousedown + click, or a third-party
      // library that attaches its own listeners, would break because an ancestor
      // grabbed the pointer out from under them.
      // To avoid forcing every such element to declare an opt-out attribute
      // (e.g. navi-own-pointer-capture) we simply listen on document instead,
      // which is safe and does not interfere with anyone else's event flow.
      const onPointerDown = (e) => {
        if (e.button !== 0) {
          // only left pointer (mouse left click, touch, pen)
          return;
        }
        pressedElements.add(el);
        const onRelease = () => {
          pressedElements.delete(el);
          document.removeEventListener("pointercancel", onRelease, true);
          document.removeEventListener("pointerup", onRelease, true);
          document.removeEventListener("contextmenu", onContextMenu, true);
          callback();
        };
        const onContextMenu = (e) => {
          // On touch devices, a long-press triggers the context menu.
          // If the context menu is not prevented, it means it will open and the
          // pointer events (pointerup, lostpointercapture) won't fire normally,
          // leaving the element stuck in pressed state. We clear it manually.
          // e.button === -1 means the event was synthesized from a long-press (not a real mouse click).
          if (e.button === -1 && !e.defaultPrevented) {
            pressedElements.delete(el);
            document.removeEventListener("pointercancel", onRelease, true);
            document.removeEventListener("pointerup", onRelease, true);
            document.removeEventListener("contextmenu", onContextMenu, true);
            callback();
          }
        };
        document.addEventListener("pointercancel", onRelease, true);
        document.addEventListener("pointerup", onRelease, true);
        document.addEventListener("contextmenu", onContextMenu, true);
        callback();
      };
      el.addEventListener("pointerdown", onPointerDown);
      return () => {
        el.removeEventListener("pointerdown", onPointerDown);
        pressedElements.delete(el);
      };
    },
    test: (el) => pressedElements.has(el),
  });
}

navi_drag: {
  definePseudoClass(":-navi-drag-grabbed", {
    attribute: "navi-drag-grabbed",
    setup: (el, callback) => {
      const onGrab = () => {
        callback();
        const onRelease = () => {
          el.removeEventListener("navi_drag_release", onRelease);
          callback();
        };
        el.addEventListener("navi_drag_release", onRelease);
      };
      el.addEventListener("navi_drag_grab", onGrab);
      return () => {
        el.removeEventListener("navi_drag_grab", onGrab);
      };
    },
    test: (el) => el.hasAttribute("data-drag-grabbed"),
  });
  definePseudoClass(":-navi-dragging", {
    attribute: "navi-dragging",
    setup: (el, callback) => {
      const onStart = () => {
        callback();
        const onRelease = () => {
          el.removeEventListener("navi_drag_release", onRelease);
          callback();
        };
        el.addEventListener("navi_drag_release", onRelease);
      };
      el.addEventListener("navi_drag_start", onStart);
      return () => {
        el.removeEventListener("navi_drag_start", onStart);
      };
    },
    test: (el) => el.hasAttribute("data-dragging"),
  });
}

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
      dispatchPseudoStateCustomEvent(
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
  element.addEventListener("navi_pseudo_state_request_check", () => {
    checkPseudoClasses();
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
  }, 1_000);
  addTeardown(() => {
    clearInterval(interval);
  });

  return teardown;
};

export const applyStyle = (
  element,
  style,
  pseudoState,
  pseudoNamedStyles,
  preventInitialTransition,
) => {
  if (!element) {
    return;
  }
  const styleToApply = getStyleToApply(style, pseudoState, pseudoNamedStyles);
  updateStyle(element, styleToApply, preventInitialTransition);
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
const elementTransitionWeakMap = new WeakMap();
const elementRenderedWeakSet = new WeakSet();
const NO_STYLE_KEY_SET = new Set();
const updateStyle = (element, style, preventInitialTransition) => {
  const styleKeySet = style ? new Set(Object.keys(style)) : NO_STYLE_KEY_SET;
  const oldStyleKeySet = styleKeySetWeakMap.get(element) || NO_STYLE_KEY_SET;
  // TRANSITION ANTI-FLICKER STRATEGY:
  // Problem: When setting both transition and styled properties simultaneously
  // (e.g., el.style.transition = "border-radius 0.3s ease"; el.style.borderRadius = "20px"),
  // the browser will immediately perform a transition even if no transition existed before.
  //
  // Solution: Temporarily disable transitions during initial style application by setting
  // transition to "none", then restore the intended transition after the frame completes.
  // We handle multiple updateStyle calls in the same frame gracefully - only one
  // requestAnimationFrame is scheduled per element, and the final transition value wins.
  let styleKeySetToApply = styleKeySet;
  if (!elementRenderedWeakSet.has(element)) {
    const hasTransition = styleKeySet.has("transition");
    if (hasTransition || preventInitialTransition) {
      if (elementTransitionWeakMap.has(element)) {
        elementTransitionWeakMap.set(element, style?.transition);
      } else {
        element.style.transition = "none";
        elementTransitionWeakMap.set(element, style?.transition);
      }
      // Don't apply the transition property now - we've set it to "none" temporarily
      styleKeySetToApply = new Set(styleKeySet);
      styleKeySetToApply.delete("transition");
    }
    requestAnimationFrame(() => {
      if (elementTransitionWeakMap.has(element)) {
        const transitionToRestore = elementTransitionWeakMap.get(element);
        if (transitionToRestore === undefined) {
          element.style.transition = "";
        } else {
          element.style.transition = transitionToRestore;
        }
        elementTransitionWeakMap.delete(element);
      }
      elementRenderedWeakSet.add(element);
    });
  }

  // Apply all styles normally (excluding transition during anti-flicker)
  const keysToDelete = new Set(oldStyleKeySet);
  for (const key of styleKeySetToApply) {
    const value = style[key];
    if (value === undefined || value === null) {
      // Treat undefined/null as "remove" — leave key in keysToDelete
      continue;
    }
    keysToDelete.delete(key);
    if (key.startsWith("--")) {
      element.style.setProperty(key, value);
    } else {
      element.style[key] = value;
    }
  }

  // Remove obsolete styles
  for (const key of keysToDelete) {
    if (key.startsWith("--")) {
      element.style.removeProperty(key);
    } else {
      element.style[key] = "";
    }
  }

  styleKeySetWeakMap.set(element, styleKeySet);
};
