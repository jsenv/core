import {
  createPubSub,
  dispatchInternalCustomEvent,
  mergeOneStyle,
} from "@jsenv/dom";

import { findControlHost, isControlHost } from "../control/control_dom.js";
import {
  findControlProxies,
  findControlProxyTarget,
} from "../control/control_proxy.js";
import { addInputEffect } from "../control/input_effect.js";
import { getUIStateFromElement } from "../control/ui_state_dom.js";

const requestPseudoStateCheck = (element, detail) => {
  dispatchInternalCustomEvent(
    element,
    "navi_pseudo_state_request_check",
    detail,
  );
  // When a control has visible proxies mirroring its state (e.g. selectable
  // radio with `navi-control-proxy-for`), re-check them too so they stay in
  // sync with the real control.
  for (const proxy of findControlProxies(element)) {
    dispatchInternalCustomEvent(
      proxy,
      "navi_pseudo_state_request_check",
      detail,
    );
  }
};
/**
 * Called back whenever `element`'s pseudo state changes.
 *
 * Kept beside the element rather than announced to the DOM: an element that
 * changes state has at most one or two interested parties, each known by name
 * (the box drawing it, the accent color reading its computed style), and a
 * CustomEvent costs its allocation and its capture/bubble walk whether anyone
 * listens or not — paid on every element, on every state change. A lookup that
 * finds nothing costs nothing.
 *
 * @param {Element} element
 * @param {(pseudoState: object, oldPseudoState: object) => void} callback
 * @returns {() => void} teardown
 */
export const subscribeToPseudoState = (element, callback) => {
  let subscriberSet = pseudoStateSubscriberSetWeakMap.get(element);
  if (!subscriberSet) {
    subscriberSet = new Set();
    pseudoStateSubscriberSetWeakMap.set(element, subscriberSet);
  }
  subscriberSet.add(callback);
  return () => {
    subscriberSet.delete(callback);
  };
};
const pseudoStateSubscriberSetWeakMap = new WeakMap();
const notifyPseudoStateSubscribers = (element, value, oldValue) => {
  const subscriberSet = pseudoStateSubscriberSetWeakMap.get(element);
  if (!subscriberSet) {
    return;
  }
  for (const subscriber of subscriberSet) {
    subscriber(value, oldValue);
  }
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
  // Written by whoever knows the current url — a Link from its href, a Button
  // from its route — so it lives here rather than with one of them.
  ":-navi-href-current": {
    attribute: "data-href-current",
  },
});
const definePseudoClass = (pseudoClass, definition) => {
  PSEUDO_CLASSES[pseudoClass] = definition;
};

// On touch devices (hover: none), browsers synthesize mouseenter/mouseleave
// from touch events but never fire mouseleave when the finger lifts, leaving
// el.matches(":hover") stuck at true. This causes hover styles (e.g. input
// background highlight) to remain visible long after the user has stopped
// touching the element. Checking (hover: hover) lets us skip hover tracking
// entirely on touch-only devices where persistent hover makes no sense.
const hoverSupported = window.matchMedia("(hover: hover)").matches;
definePseudoClass(":hover", {
  attribute: "data-hover",
  setup: (el, callback) => {
    if (!hoverSupported) {
      return () => {};
    }
    const recheckProxy = (e) => {
      for (const proxy of findControlProxies(el)) {
        requestPseudoStateCheck(proxy, { event: e });
      }
    };
    const recheckProxyTarget = (e) => {
      const proxyTarget = findControlProxyTarget(el);
      if (proxyTarget) {
        requestPseudoStateCheck(proxyTarget, { event: e });
      }
    };
    let onmouseenter = (e) => {
      callback();
      recheckProxy(e);
      recheckProxyTarget(e);
    };
    let onmouseleave = (e) => {
      callback();
      recheckProxy(e);
      recheckProxyTarget(e);
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
      const _onmouseenter = onmouseenter;
      onmouseenter = (e) => {
        recheckInput(e);
        _onmouseenter(e);
      };
      const _onmouseleave = onmouseleave;
      onmouseleave = (e) => {
        recheckInput(e);
        _onmouseleave(e);
      };
    }

    el.addEventListener("mouseenter", onmouseenter);
    el.addEventListener("mouseleave", onmouseleave);
    return () => {
      el.removeEventListener("mouseenter", onmouseenter);
      el.removeEventListener("mouseleave", onmouseleave);
    };
  },
  test: (el) => {
    if (!hoverSupported) {
      return false;
    }
    if (el.matches(":hover")) {
      return true;
    }
    for (const proxy of findControlProxies(el)) {
      if (proxy.matches(":hover")) {
        return true;
      }
    }
    return false;
  },
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
      // el.readOnly = true;
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
      // el.readOnly = false;
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
      // Listen to changes on the radio
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
        el.removeEventListener("input", callback);
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

// The current input modality: true after a keyboard navigation key (arrow keys,
// Escape, Enter, Ctrl, Alt, Shift, Space — Space ignored on editable fields),
// false after a pointer interaction. Updated by the listeners in the
// focus_classes block below. At module scope so isMatchingFocusVisible (used
// here and in control_hooks.jsx) can read it.
let keyboardNavigationUsed = false;

// HOW FOCUS-VISIBLE IS DECIDED (the details behind isMatchingFocusVisible)
//
// Two rules, depending on what `el` is:
//
// 1. An EDITABLE target (text-ish input, textarea, contenteditable — anything
//    whose whole point is keyboard input, see isEditableTarget) shows its ring
//    whenever it holds the focus, however the focus arrived — mouse,
//    programmatic, even a focus({ focusVisible: false }). Being focused, for
//    such a field, means being about to type, and that is what the ring
//    announces. Its check is on :focus rather than :focus-visible on purpose:
//    the native :focus-visible obeys the focusVisible option, which callers
//    set from the modality without knowing what they are focusing.
//
// 2. Anything else needs BOTH the native :focus-visible match AND the current
//    modality being keyboard (`keyboardNavigationUsed`).
//
//    The native match alone cannot be trusted, because we routinely take the
//    pointer out of the browser's hands: a picker opens on mousedown and calls
//    preventDefault() so the browser does not move focus itself (see
//    picker_custom.jsx). The browser therefore never registers that a pointer
//    was what moved focus, and whatever focus-visible state the previous
//    keyboard interaction left behind stays true — even across the
//    programmatic focus({ focusVisible: false }) that follows. Close a picker
//    with Escape (ring on the trigger, rightly) and click it open again: the
//    popup's own focusable would come up ringed, from a mouse press.
//
//    `keyboardNavigationUsed` has no such blind spot — it is set by navigation
//    keydowns and cleared by pointerdown, whatever anyone prevents afterwards
//    — so it is the authority for everything rule 1 does not cover.
//
// Ring INHERITANCE (a controlled element ringing because its aria-controls
// controller is focused) stays gated on the keyboard modality even for an
// editable controller — see hasIndirectFocus: propagating a ring promises
// keyboard shortcuts will drive the controlled element, a promise that only
// holds once a physical keyboard has actually been used.
/**
 * Whether `el` should currently show a focus ring — the enriched
 * :focus-visible behind every [data-focus-visible] navi renders.
 * Use this instead of a bare el.matches(":focus-visible") wherever
 * focus-visible is evaluated; the comment above details the rules.
 * @param {Element} el
 * @returns {boolean}
 */
export const isMatchingFocusVisible = (el) => {
  if (isEditableTarget(el)) {
    return el.matches(":focus");
  }
  if (!el.matches(":focus-visible")) {
    return false;
  }
  if (!keyboardNavigationUsed) {
    return false;
  }
  return true;
};

// Elements that invite keyboard input: focusing one — even with the mouse —
// means the user is about to type, so they always warrant a visible focus.
// Also used to ignore the Space key as a navigation key while typing, and by
// programmatic focus (focus_transfer.js) to pass focusVisible: true so the
// native :focus-visible agrees with the ring rule 1 above draws.
const EDITABLE_INPUT_TYPE_SET = new Set([
  "text",
  "search",
  "url",
  "email",
  "password",
  "tel",
  "number",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
]);
export const isEditableTarget = (target) => {
  if (!target) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "TEXTAREA") {
    return !target.readOnly;
  }
  if (tag === "INPUT") {
    if (!target.type || EDITABLE_INPUT_TYPE_SET.has(target.type)) {
      return !target.readOnly;
    }
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
};

// The current modality, for code deciding whether something it is about to
// focus should show a ring — a slide arriving, a popup opening. The question is
// "was the user on the keyboard when this was asked for", which is what this
// flag says; the element that happens to hold the focus right now says nothing
// about it (it may have been focused programmatically, ring or no ring, by the
// travel before this one).
export const isKeyboardModality = () => keyboardNavigationUsed;

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
  // notify the elements it controls via aria-controls so they re-check their
  // focus state. `requestPseudoStateCheck` also re-checks the controlled
  // element's proxy (if any), so the visible proxy mirrors the hidden real
  // input's inherited focus.
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
  // Tracks whether the user has pressed a keyboard navigation key (arrow keys,
  // Escape, Enter, Ctrl, Alt, Shift, Space) since the last pointer interaction.
  // Space is ignored when the target is an editable field.
  // This flag is used to gate focus-visible inheritance via aria-controls:
  // on mobile (or when the user hasn't used keyboard nav yet) an input that
  // controls a radio should not cause the radio to show a focus ring.
  // (Declared at module scope — see keyboardNavigationUsed above.)
  const NAVIGATION_KEY_SET = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Escape",
    "Enter",
    "Control",
    "Alt",
    "Shift",
    " ",
    "Tab",
  ]);
  document.addEventListener(
    "keydown",
    (e) => {
      if (!NAVIGATION_KEY_SET.has(e.key)) {
        return;
      }
      if (e.key === " " && isEditableTarget(e.target)) {
        return;
      }
      keyboardNavigationUsed = true;
    },
    { capture: true },
  );
  document.addEventListener(
    "pointerdown",
    () => {
      keyboardNavigationUsed = false;
    },
    { capture: true },
  );

  // A keystroke flips keyboardNavigationUsed, which can turn :focus-visible on —
  // but only for the element that holds focus, directly or through aria-controls
  // / a proxy. Pressing a key cannot reveal a focus ring on an unfocused element.
  // So a single shared handler re-checks just that focus chain (the active
  // element, what it controls, and its proxy — the last two via
  // requestPseudoStateCheck / notifyAriaControlled). This runs in the bubble
  // phase, after the capture-phase listener above has updated the flag.
  //
  // The alternative — each registered :focus-visible element adding its own
  // document keydown listener that re-tests itself — makes one keypress cost
  // O(number-of-boxes) full-document [aria-controls] / proxy queries, since every
  // unfocused element falls through matches(":focus-visible") into hasIndirectFocus.
  const recheckFocusChainOnKey = (e) => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      return;
    }
    requestPseudoStateCheck(active, { event: e });
    notifyAriaControlled(active, e);
  };
  document.addEventListener("keydown", recheckFocusChainOnKey);
  document.addEventListener("keyup", recheckFocusChainOnKey);

  // Returns true when el holds focus indirectly — either because a controlling
  // element (aria-controls) has focus, or because el is a proxy whose target
  // is itself controlled by a focused element.
  const hasIndirectFocus = (el, { requireFocusVisible = false } = {}) => {
    // No ring inheritance without a keyboard: an editable target draws its own
    // ring on any focus (see isMatchingFocusVisible), but propagating that ring
    // to a controlled element (aria-controls) is a promise that keyboard
    // shortcuts will drive it — a promise that holds only once a physical
    // keyboard has actually been used. On touch devices the flag stays false
    // and a focused search input keeps its ring to itself.
    if (requireFocusVisible && !keyboardNavigationUsed) {
      return false;
    }
    // A controller/proxy counts as focused for inheritance via the same rule
    // used everywhere: :focus for plain inheritance, isMatchingFocusVisible for
    // the focus-visible variant (so a mouse-focused controller doesn't propagate
    // a ring).
    const isFocusedTarget = (target) =>
      requireFocusVisible
        ? isMatchingFocusVisible(target)
        : target.matches(":focus");
    // Both branches of isFocusedTarget rest on :focus / :focus-visible, and only
    // one element in the document can match those: document.activeElement. So
    // the single controller worth testing is known upfront — asking the document
    // for every [aria-controls] would collect candidates that cannot qualify,
    // once per element and again on every re-check, on a document each new
    // element makes bigger.
    const isControlledBy = (target) => {
      const id = target.id;
      if (!id) {
        return false;
      }
      const activeElement = document.activeElement;
      if (!activeElement || activeElement === document.body) {
        return false;
      }
      if (!activeElement.matches(`[aria-controls~="${id}"]`)) {
        return false;
      }
      // A controller inside the element it controls means focus is already
      // native (:focus-within) — nothing to inherit.
      if (target.contains(activeElement)) {
        return false;
      }
      return isFocusedTarget(activeElement);
    };
    if (isControlledBy(el)) {
      return true;
    }
    const proxyTarget = findControlProxyTarget(el);
    if (proxyTarget) {
      if (isFocusedTarget(proxyTarget)) {
        return true;
      }
      if (isControlledBy(proxyTarget)) {
        return true;
      }
    }
    return false;
  };

  // One registration per element for everything focus-related, shared by
  // :focus, :focus-visible and :focus-within: they all react to the same
  // focusin/focusout, and they all re-check through the same callback (see
  // initPseudoStyles), which the Set turns into one call.
  const focusTrackingWeakMap = new WeakMap();
  const trackFocus = (el, callback) => {
    let tracking = focusTrackingWeakMap.get(el);
    if (!tracking) {
      const callbackSet = new Set();
      const onFocusChange = (e) => {
        for (const trackedCallback of callbackSet) {
          trackedCallback();
        }
        notifyAriaControlled(el, e);
      };
      el.addEventListener("focusin", onFocusChange);
      el.addEventListener("focusout", onFocusChange);
      tracking = {
        callbackSet,
        teardown: () => {
          el.removeEventListener("focusin", onFocusChange);
          el.removeEventListener("focusout", onFocusChange);
          focusTrackingWeakMap.delete(el);
        },
      };
      focusTrackingWeakMap.set(el, tracking);
      observeAriaControls();
    }
    tracking.callbackSet.add(callback);
    return () => {
      tracking.callbackSet.delete(callback);
      if (tracking.callbackSet.size === 0) {
        tracking.teardown();
      }
    };
  };
  // When aria-controls changes on a focused element, what it used to control
  // and what it controls now both re-check their inherited focus. One observer
  // on the document rather than one per tracked element: the attribute changes
  // rarely, on few elements, while thousands are tracked — and it can be set
  // after the element was, so "has it at setup" would miss it.
  let ariaControlsObserver = null;
  const observeAriaControls = () => {
    if (ariaControlsObserver) {
      return;
    }
    ariaControlsObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const el = mutation.target;
        if (!focusTrackingWeakMap.has(el)) {
          continue;
        }
        if (!el.matches(":focus-within")) {
          continue;
        }
        const oldIds = (mutation.oldValue || "").split(" ").filter(Boolean);
        for (const id of oldIds) {
          const controlled = document.getElementById(id);
          if (controlled) {
            requestPseudoStateCheck(controlled, {});
          }
        }
        notifyAriaControlled(el, {});
      }
    });
    ariaControlsObserver.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-controls"],
      attributeOldValue: true,
    });
  };

  definePseudoClass(":focus", {
    attribute: "data-focus",
    setup: trackFocus,
    test: (el) => {
      if (el.matches(":focus")) {
        return true;
      }
      if (hasIndirectFocus(el)) {
        return true;
      }
      return false;
    },
  });
  definePseudoClass(":focus-visible", {
    attribute: "data-focus-visible",
    // No per-element keydown/keyup listener: the shared recheckFocusChainOnKey
    // handler re-checks the focused element (the only one a keystroke can turn
    // focus-visible) so a keypress stays O(1), not O(number-of-boxes).
    setup: trackFocus,
    test: (el) => {
      if (isMatchingFocusVisible(el)) {
        return true;
      }
      if (hasIndirectFocus(el, { requireFocusVisible: true })) {
        return true;
      }
      return false;
    },
  });
  definePseudoClass(":focus-within", {
    attribute: "data-focus-within",
    setup: trackFocus,
    test: (el) => {
      if (el.matches(":focus-within")) {
        return true;
      }
      if (hasIndirectFocus(el)) {
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
    const controlHost = findControlHost(el) || el;
    return addInputEffect(controlHost, callback);
  },
  test: (el) => {
    if (isControlHost(el)) {
      const uiState = getUIStateFromElement(el);
      if (uiState === undefined || uiState === "") {
        return false;
      }
      return true;
    }
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
const elementToImpactWeakMap = new WeakMap();
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
  elementToImpactWeakMap.set(element, elementToImpact);
  if (elementListeningPseudoState === element) {
    console.warn(
      `elementListeningPseudoState should not be the same as element to avoid infinite loop`,
    );
    elementListeningPseudoState = null;
  }

  const proxyTarget = findControlProxyTarget(element);

  const onStateChange = (value, oldValue) => {
    effect?.(value, oldValue);
    if (elementListeningPseudoState) {
      notifyPseudoStateSubscribers(
        elementListeningPseudoState,
        value,
        oldValue,
      );
    }
    // When this element's state changes, notify any proxy element that mirrors it
    // so it can re-check and visually reflect the new state.
    for (const proxy of findControlProxies(element)) {
      requestPseudoStateCheck(proxy, {});
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
      // If this element is a proxy for another (navi-control-proxy-for="targetId"),
      // inherit the target's active pseudo-state when the element itself isn't in that state.
      // We check the target's elementToImpact (not the target itself) because the
      // data-* attribute may be set on a different element (e.g. pseudoStateSelector).
      if (!currentValue && proxyTarget) {
        const { attribute } = pseudoClassDefinition;
        if (attribute) {
          const targetElementToImpact =
            elementToImpactWeakMap.get(proxyTarget) || proxyTarget;
          if (targetElementToImpact.hasAttribute(attribute)) {
            currentValue = true;
          }
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

  addTeardown(
    subscribeToPseudoState(element, (pseudoState, oldPseudoState) => {
      state = pseudoState;
      onStateChange(state, oldPseudoState);
    }),
  );
  // One function for every way a re-check can be asked, so that setups
  // registering it side by side (the focus tracking, for one) hold the same
  // callback and call it once.
  const requestCheck = () => {
    checkPseudoClasses();
  };
  element.addEventListener("navi_pseudo_state_request_check", requestCheck);
  addTeardown(() => {
    element.removeEventListener(
      "navi_pseudo_state_request_check",
      requestCheck,
    );
  });

  for (const pseudoClass of pseudoClasses) {
    const pseudoClassDefinition = PSEUDO_CLASSES[pseudoClass];
    if (!pseudoClassDefinition) {
      console.warn(`Unknown pseudo class: ${pseudoClass}`);
      continue;
    }
    const { setup } = pseudoClassDefinition;
    if (setup) {
      const cleanup = setup(element, requestCheck);
      addTeardown(cleanup);
    }
  }
  checkPseudoClasses();
  if (import.meta.dev) {
    // just in case + catch use forcing them in chrome devtools
    addTeardown(pollInDev(requestCheck));
  }

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
  // The same object comes back for every state change of a box whose inline
  // style has no pseudo entry: nothing to write.
  if (appliedStyleWeakMap.get(element) === styleToApply) {
    return;
  }
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
  let style = styles;
  for (const pseudoKey of Object.keys(pseudoNamedStyles)) {
    const requiredStates = getPseudoKeyRequiredStates(pseudoKey);
    if (!requiredStates.every((state) => pseudoState[state])) {
      continue;
    }
    if (style === styles) {
      style = { ...styles };
    }
    // Both sides are already normalized for CSS by the box; only the
    // properties that compose (a press scale on top of a translate) go through
    // a merge, the rest is a plain override.
    const styleToAdd = pseudoNamedStyles[pseudoKey];
    for (const key of Object.keys(styleToAdd)) {
      const value = styleToAdd[key];
      if (value === undefined) {
        continue;
      }
      if (key === "transform" || key === "willChange") {
        style[key] = mergeOneStyle(style[key], value, key, "css");
      } else {
        style[key] = value;
      }
    }
  }
  return style;
};

// The state names a pseudo key asks for, parsed once: the same few keys come
// back on every state change of every box that has them. "::x" alone always
// matches; "::x:a:b" and ":a:b" ask for ":a" and ":b" — the state keys as
// checkPseudoClasses writes them, colon included.
const pseudoKeyRequiredStatesMap = new Map();
const getPseudoKeyRequiredStates = (pseudoKey) => {
  const cached = pseudoKeyRequiredStatesMap.get(pseudoKey);
  if (cached) {
    return cached;
  }
  let requiredStates;
  if (pseudoKey.startsWith("::")) {
    const nextColonIndex = pseudoKey.indexOf(":", 2);
    requiredStates =
      nextColonIndex === -1
        ? []
        : getPseudoKeyRequiredStates(pseudoKey.slice(nextColonIndex));
  } else {
    const nextColonIndex = pseudoKey.indexOf(":", 1);
    requiredStates =
      nextColonIndex === -1
        ? [pseudoKey]
        : pseudoKey
            .slice(1)
            .split(":")
            .map((state) => `:${state}`);
  }
  pseudoKeyRequiredStatesMap.set(pseudoKey, requiredStates);
  return requiredStates;
};

// element → the style object last written to it, so the next one is written
// as a difference: the values that changed, the keys it no longer has.
const appliedStyleWeakMap = new WeakMap();
const elementTransitionWeakMap = new WeakMap();
const elementRenderedWeakSet = new WeakSet();
const NO_STYLE = {};
const updateStyle = (element, style, preventInitialTransition) => {
  const styleToApply = style || NO_STYLE;
  const styleApplied = appliedStyleWeakMap.get(element) || NO_STYLE;
  // TRANSITION ANTI-FLICKER STRATEGY:
  // Problem: When setting both transition and styled properties simultaneously
  // (e.g., el.style.transition = "border-radius 0.3s ease"; el.style.borderRadius = "20px"),
  // the browser will immediately perform a transition even if no transition existed before.
  //
  // Solution: Temporarily disable transitions during initial style application by setting
  // transition to "none", then restore the intended transition after the frame completes.
  // We handle multiple updateStyle calls in the same frame gracefully - only one
  // requestAnimationFrame is scheduled per element, and the final transition value wins.
  let skipTransition = false;
  if (!elementRenderedWeakSet.has(element)) {
    const hasTransition = Object.hasOwn(styleToApply, "transition");
    if (hasTransition || preventInitialTransition) {
      if (!elementTransitionWeakMap.has(element)) {
        element.style.transition = "none";
      }
      elementTransitionWeakMap.set(element, styleToApply.transition);
      // Stays "none" until the first frame puts the intended value back
      skipTransition = true;
    }
    afterFirstFrame(element);
  }

  for (const key of Object.keys(styleToApply)) {
    const value = styleToApply[key];
    if (value === undefined || value === null) {
      // a removal: handled below with the keys this style no longer has
      continue;
    }
    if (skipTransition && key === "transition") {
      continue;
    }
    if (styleApplied[key] === value) {
      continue;
    }
    if (key.startsWith("--")) {
      element.style.setProperty(key, value);
    } else {
      element.style[key] = value;
    }
  }

  for (const key of Object.keys(styleApplied)) {
    const previousValue = styleApplied[key];
    if (previousValue === undefined || previousValue === null) {
      continue;
    }
    const value = styleToApply[key];
    if (value !== undefined && value !== null) {
      continue;
    }
    if (key.startsWith("--")) {
      element.style.removeProperty(key);
    } else {
      element.style[key] = "";
    }
  }

  appliedStyleWeakMap.set(element, styleToApply);
};

// One frame for every element waiting for its first one, not one frame each.
// What this owes each element — put back the transition suppressed above, and
// remember it has now been painted once — is a few microseconds, while asking
// the browser for a frame costs more than that, and a page mounting thousands of
// boxes asks thousands of times in the same tick. A Set, so an element styled
// twice before the frame arrives is still one entry.
const elementSetWaitingFirstFrame = new Set();
let firstFrameScheduled = false;
const afterFirstFrame = (element) => {
  elementSetWaitingFirstFrame.add(element);
  if (firstFrameScheduled) {
    return;
  }
  firstFrameScheduled = true;
  requestAnimationFrame(() => {
    firstFrameScheduled = false;
    const elements = [...elementSetWaitingFirstFrame];
    elementSetWaitingFirstFrame.clear();
    for (const element of elements) {
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
    }
  });
};

// Dev only: a periodic re-check for what nothing announces — a state forced
// from the devtools. One interval walking every registered check rather than
// one per element: a page of a thousand boxes would otherwise run a thousand
// timers a second.
const devPollCheckSet = new Set();
let devPollInterval = null;
const pollInDev = (check) => {
  devPollCheckSet.add(check);
  if (devPollInterval === null) {
    devPollInterval = setInterval(() => {
      for (const registeredCheck of devPollCheckSet) {
        registeredCheck();
      }
    }, 1_000);
  }
  return () => {
    devPollCheckSet.delete(check);
    if (devPollCheckSet.size === 0) {
      clearInterval(devPollInterval);
      devPollInterval = null;
    }
  };
};
