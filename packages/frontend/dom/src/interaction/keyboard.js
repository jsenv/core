/**
 * Returns the browser's default action for a keyboard event on its target element.
 *
 * Possible return values:
 * - `"activate"`     — Space/Enter triggers the element's primary action (button click, checkbox toggle, picker open…)
 * - `"form_submit"`  — Enter submits the enclosing form (single-line inputs)
 * - `"dismiss"`      — Escape closes a dialog, clears a search field, collapses a dropdown
 * - `"focus_nav"`    — key moves focus (Tab, arrow keys in a radio/checkbox group)
 * - `"value_change"` — key increments/decrements the field value (range, number, date…)
 * - `"cursor_move"`  — key moves the text cursor within the field
 * - `"type"`         — key produces or deletes text content
 * - `"scroll"`       — key scrolls the page or a scrollable container
 * - `""`             — no meaningful browser default; safe to intercept freely
 */
export const normalizeKeyboardKey = (rawKey) => {
  // The browser sends " " for the Space bar; map it to the friendly name "space"
  if (rawKey === " ") {
    return "space";
  }
  return rawKey.toLowerCase();
};

export const getKeyboardEventDefaultAction = (keyboardEvent) => {
  const target = keyboardEvent.target;
  const key = normalizeKeyboardKey(keyboardEvent.key);

  // Nothing special occurs when the target or an ancestor is disabled/inert
  if (
    target.disabled ||
    target.closest("[disabled]") ||
    target.inert ||
    target.closest("[inert]")
  ) {
    return "";
  }
  for (const { test, keys, fallback } of DEFAULT_BEHAVIORS) {
    if (!test(target)) {
      continue;
    }
    if (Object.hasOwn(keys, key)) {
      const value = keys[key];
      const defaultActionForKey =
        typeof value === "function" ? value(keyboardEvent) : value;
      if (defaultActionForKey !== undefined) {
        return defaultActionForKey;
      }
    }
    if (fallback === undefined) {
      // This entry only handles specific keys — keep looking for other entries
      continue;
    }
    const defaultAction =
      typeof fallback === "function" ? fallback(keyboardEvent) : fallback;
    if (defaultAction !== undefined) {
      return defaultAction;
    }
  }
  return "";
};

const isTypingIntent = (e) => {
  // Modifier keys used for shortcuts: skip
  if (e.metaKey || e.ctrlKey) {
    return false;
  }
  const key = normalizeKeyboardKey(e.key);
  // Single printable character — the user is typing
  if (e.key.length === 1) {
    return true;
  }
  // Editing keys that would modify the text
  if (key === "backspace" || key === "delete") {
    return true;
  }
  return false;
};

const DEFAULT_BEHAVIORS = [
  {
    test: () => true,
    keys: {
      // Tab moves focus on any element
      tab: "focus_nav",
    },
    // no fallback: only claims Tab, other keys continue to next entries
  },
  {
    // Escape natively dismisses only <dialog> elements
    test: (el) => el.tagName === "DIALOG" || Boolean(el.closest("dialog")),
    keys: {
      escape: "dismiss",
    },
  },
  {
    test: (el) => el.matches("input[type='radio'], input[type='checkbox']"),
    keys: {
      space: "activate",
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: "focus_nav",
      arrowright: "focus_nav",
      arrowup: "focus_nav",
      arrowdown: "focus_nav",
    },
  },
  {
    test: (el) =>
      el.matches(
        "input:not([type]), input[type='text'], input[type='search'], input[type='url'], input[type='email'], input[type='password'], input[type='tel']",
      ),
    keys: {
      escape: (e) => {
        if (e.target.type === "search") {
          return e.target.value ? "clear" : "";
        }
        return "";
      },
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: "cursor_move",
      arrowright: "cursor_move",
      arrowup: "cursor_move",
      arrowdown: "cursor_move",
      home: "cursor_move",
      end: "cursor_move",
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    test: (el) => el.matches("input[type='range']"),
    keys: {
      space: "scroll",
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: "value_change",
      arrowright: "value_change",
      arrowup: "value_change",
      arrowdown: "value_change",
      home: "value_change",
      end: "value_change",
      pageup: "value_change",
      pagedown: "value_change",
    },
  },
  {
    test: (el) => el.matches("input[type='number']"),
    keys: {
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: "cursor_move",
      arrowright: "cursor_move",
      arrowup: "value_change",
      arrowdown: "value_change",
      home: "cursor_move",
      end: "cursor_move",
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    test: (el) =>
      el.matches(
        "input[type='date'], input[type='time'], input[type='datetime-local'], input[type='month'], input[type='week']",
      ),
    keys: {
      space: "activate",
      enter: (e) => (e.target.form ? "form_submit" : ""),
      arrowleft: "value_change",
      arrowright: "value_change",
      arrowup: "value_change",
      arrowdown: "value_change",
    },
  },
  {
    // Color input: Space opens the color picker, Enter submits the form
    test: (el) => el.matches("input[type='color']"),
    keys: {
      space: "activate",
      enter: (e) => (e.target.form ? "form_submit" : ""),
    },
  },
  {
    // File input: Space opens the picker, Enter submits the form
    test: (el) => el.matches("input[type='file']"),
    keys: {
      space: "activate",
      enter: (e) => (e.target.form ? "form_submit" : ""),
    },
  },
  {
    // Generic INPUT fallback for any remaining input types
    test: (el) => el.tagName === "INPUT",
    keys: {},
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    test: (el) =>
      el.tagName === "TEXTAREA" ||
      el.contentEditable === "true" ||
      el.isContentEditable,
    keys: {
      enter: "type",
      arrowleft: "cursor_move",
      arrowright: "cursor_move",
      arrowup: "cursor_move",
      arrowdown: "cursor_move",
      home: "cursor_move",
      end: "cursor_move",
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    // Buttons and links: Space/Enter trigger the element's default action
    test: (el) =>
      el.tagName === "BUTTON" ||
      el.tagName === "A" ||
      el.getAttribute("role") === "button",
    keys: {
      space: "activate",
      enter: "activate",
    },
  },
  {
    // details/summary: Space/Enter toggle the disclosure widget
    test: (el) => el.tagName === "DETAILS" || el.tagName === "SUMMARY",
    keys: {
      space: "activate",
      enter: "activate",
    },
  },
  {
    // SELECT: don't intercept anything while the dropdown may be open
    test: (el) => el.tagName === "SELECT",
    keys: {},
  },
  {
    // Non-interactive elements: browser scrolls on Space and arrow keys
    test: () => true,
    keys: {
      space: "scroll",
      arrowup: "scroll",
      arrowdown: "scroll",
      arrowleft: "scroll",
      arrowright: "scroll",
      pageup: "scroll",
      pagedown: "scroll",
      home: "scroll",
      end: "scroll",
    },
  },
];
