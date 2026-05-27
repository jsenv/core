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
export const getKeyboardEventDefaultAction = (keyboardEvent) => {
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
      // Escape dismisses on any element (dialog, search clear, dropdown close, etc.)
      Escape: "dismiss",
    },
    // no fallback: only claims Tab/Escape, other keys continue to next entries
  },
  {
    test: (el) => el.matches("input[type='radio'], input[type='checkbox']"),
    keys: {
      Space: "activate",
      Enter: (e) => (e.target.form ? "form_submit" : ""),
      ArrowLeft: "focus_nav",
      ArrowRight: "focus_nav",
      ArrowUp: "focus_nav",
      ArrowDown: "focus_nav",
    },
  },
  {
    test: (el) =>
      el.matches(
        "input:not([type]), input[type='text'], input[type='search'], input[type='url'], input[type='email'], input[type='password'], input[type='tel']",
      ),
    keys: {
      Enter: (e) => (e.target.form ? "form_submit" : ""),
      ArrowLeft: "cursor_move",
      ArrowRight: "cursor_move",
      ArrowUp: "cursor_move",
      ArrowDown: "cursor_move",
      Home: "cursor_move",
      End: "cursor_move",
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    test: (el) => el.matches("input[type='range']"),
    keys: {
      Space: "scroll",
      Enter: (e) => (e.target.form ? "form_submit" : ""),
      ArrowLeft: "value_change",
      ArrowRight: "value_change",
      ArrowUp: "value_change",
      ArrowDown: "value_change",
      Home: "value_change",
      End: "value_change",
      PageUp: "value_change",
      PageDown: "value_change",
    },
  },
  {
    test: (el) => el.matches("input[type='number']"),
    keys: {
      Enter: (e) => (e.target.form ? "form_submit" : ""),
      ArrowLeft: "cursor_move",
      ArrowRight: "cursor_move",
      ArrowUp: "value_change",
      ArrowDown: "value_change",
      Home: "cursor_move",
      End: "cursor_move",
    },
    fallback: (e) => (isTypingIntent(e) ? "type" : undefined),
  },
  {
    test: (el) =>
      el.matches(
        "input[type='date'], input[type='time'], input[type='datetime-local'], input[type='month'], input[type='week']",
      ),
    keys: {
      Space: "activate",
      Enter: (e) => (e.target.form ? "form_submit" : ""),
      ArrowLeft: "value_change",
      ArrowRight: "value_change",
      ArrowUp: "value_change",
      ArrowDown: "value_change",
    },
  },
  {
    // Color input: Space opens the color picker, Enter submits the form
    test: (el) => el.matches("input[type='color']"),
    keys: {
      Space: "activate",
      Enter: (e) => (e.target.form ? "form_submit" : ""),
    },
  },
  {
    // File input: Space opens the picker, Enter submits the form
    test: (el) => el.matches("input[type='file']"),
    keys: {
      Space: "activate",
      Enter: (e) => (e.target.form ? "form_submit" : ""),
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
      Enter: "type",
      ArrowLeft: "cursor_move",
      ArrowRight: "cursor_move",
      ArrowUp: "cursor_move",
      ArrowDown: "cursor_move",
      Home: "cursor_move",
      End: "cursor_move",
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
      Space: "activate",
      Enter: "activate",
    },
  },
  {
    // details/summary: Space/Enter toggle the disclosure widget
    test: (el) => el.tagName === "DETAILS" || el.tagName === "SUMMARY",
    keys: {
      Space: "activate",
      Enter: "activate",
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
      Space: "scroll",
      ArrowUp: "scroll",
      ArrowDown: "scroll",
      ArrowLeft: "scroll",
      ArrowRight: "scroll",
      PageUp: "scroll",
      PageDown: "scroll",
      Home: "scroll",
      End: "scroll",
    },
  },
];

export const canInterceptKeyboardEvent = (event, { intent } = {}) => {
  const defaultBehavior = getKeyboardEventDefaultAction(event);
  if (!defaultBehavior) {
    return true;
  }
  if (intent === "override_focus_nav") {
    // A focus group takes over arrow-key navigation entirely, including cases
    // where the browser would otherwise scroll (e.g. arrow keys on a <button>).
    if (defaultBehavior === "focus_nav" || defaultBehavior === "scroll") {
      return true;
    }
  }
  return false;
};
