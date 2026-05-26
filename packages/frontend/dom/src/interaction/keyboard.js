/**
 * Returns the browser's default behavior for a keyboard event on its target element.
 *
 * Possible return values:
 * - `"focus_nav"`    — key moves focus (Tab, arrow in radio/checkbox group)
 * - `"value_change"` — key increments/decrements the field value (number, range, date…)
 * - `"cursor_move"`  — key moves the text cursor within the field
 * - `"type"`         — key produces or deletes text content
 * - `"form_submit"`  — Enter on a single-line input submits the enclosing form
 * - `"activate"`     — Space/Enter triggers the element's action (button, link)
 * - `""`             — no meaningful browser default; safe to intercept freely
 */
export const getKeyboardEventBehavior = (keyboardEvent) => {
  const target = keyboardEvent.target;
  const key = keyboardEvent.key;

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
      return typeof value === "function" ? value(keyboardEvent) : value;
    }
    if (fallback === undefined) {
      // This entry only handles specific keys — keep looking for other entries
      continue;
    }
    return typeof fallback === "function" ? fallback(keyboardEvent) : fallback;
  }
  return "";
};

const isTypingIntent = (e) => {
  // Modifier keys used for shortcuts: skip
  if (e.metaKey || e.ctrlKey) {
    return false;
  }
  const { key } = e;
  // Single printable character — the user is typing
  if (key.length === 1) {
    return true;
  }
  // Editing keys that would modify the text
  if (key === "Backspace" || key === "Delete") {
    return true;
  }
  return false;
};

const DEFAULT_BEHAVIORS = [
  {
    test: () => true,
    keys: {
      // Tab moves focus on any element
      Tab: "focus_nav",
    },
    // no fallback: only claims Tab, other keys continue to next entries
  },
  {
    test: (el) => el.matches("input[type='radio'], input[type='checkbox']"),
    keys: {
      ArrowLeft: "focus_nav",
      ArrowRight: "focus_nav",
      ArrowUp: "focus_nav",
      ArrowDown: "focus_nav",
    },
    fallback: "",
  },
  {
    test: (el) => el.matches("input[type='range']"),
    keys: {
      ArrowLeft: "value_change",
      ArrowRight: "value_change",
      ArrowUp: "value_change",
      ArrowDown: "value_change",
    },
    fallback: "",
  },
  {
    test: (el) =>
      el.matches(
        "input[type='date'], input[type='time'], input[type='datetime-local'], input[type='month'], input[type='week']",
      ),
    keys: {
      ArrowLeft: "value_change",
      ArrowRight: "value_change",
      ArrowUp: "value_change",
      ArrowDown: "value_change",
    },
    fallback: "",
  },
  {
    test: (el) => el.matches("input[type='number']"),
    keys: {
      ArrowLeft: "cursor_move",
      ArrowRight: "cursor_move",
      ArrowUp: "value_change",
      ArrowDown: "value_change",
      Home: "cursor_move",
      End: "cursor_move",
      Enter: (e) => (e.target.form ? "form_submit" : ""),
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : ""),
  },
  {
    test: (el) =>
      el.matches(
        "input[type='text'], input[type='search'], input[type='url'], input[type='email'], input[type='password'], input[type='tel']",
      ),
    keys: {
      ArrowLeft: "cursor_move",
      ArrowRight: "cursor_move",
      Home: "cursor_move",
      End: "cursor_move",
      Enter: (e) => (e.target.form ? "form_submit" : ""),
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : ""),
  },
  {
    // Generic INPUT fallback for any remaining input types
    test: (el) => el.tagName === "INPUT",
    keys: {},
    fallback: (e) => (isTypingIntent(e) ? "type" : ""),
  },
  {
    test: (el) =>
      el.tagName === "TEXTAREA" ||
      el.contentEditable === "true" ||
      el.isContentEditable,
    keys: {
      ArrowLeft: "cursor_move",
      ArrowRight: "cursor_move",
      ArrowUp: "cursor_move",
      ArrowDown: "cursor_move",
      Home: "cursor_move",
      End: "cursor_move",
      Enter: "type",
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : ""),
  },
  {
    // Buttons and links: Space/Enter trigger the element's default action
    test: (el) =>
      el.tagName === "BUTTON" ||
      el.tagName === "A" ||
      el.getAttribute("role") === "button",
    keys: {
      Space: "activate",
      Enter: "activate",
    },
    fallback: "",
  },
  {
    // SELECT: don't intercept anything while the dropdown may be open
    test: (el) => el.tagName === "SELECT",
    keys: {},
    fallback: "",
  },
];

export const canInterceptKeyboardEvent = (event, { intent } = {}) => {
  const defaultBehavior = getKeyboardEventBehavior(event);
  if (!defaultBehavior) {
    return true;
  }
  if (intent === "override_focus_nav" && defaultBehavior === "focus_nav") {
    return true;
  }
  return false;
};
