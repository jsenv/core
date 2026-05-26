/**
 * Returns the browser's default behavior for a keyboard event on its target element.
 *
 * Possible return values:
 * - `"focus_nav"`   — arrow key moves focus between sibling inputs (radio/checkbox groups)
 * - `"value_change"` — arrow key increments/decrements the field value (number, range, date…)
 * - `"cursor_move"` — arrow/Home/End moves the text cursor within the field
 * - `"type"`        — key produces or deletes text content
 * - `""`            — no meaningful browser default; safe to intercept freely
 * - `true`          — non-input element that has its own browser defaults (scroll, etc.)
 */
export const getKeyboardEventDefault = (keyboardEvent) => {
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

  if (key === "Tab") {
    return "focus_nav";
  }

  if (target.tagName === "INPUT") {
    if (key === "ArrowLeft" || key === "ArrowRight") {
      if (target.type === "radio" || target.type === "checkbox") {
        // Browser moves focus to the previous/next sibling in the radio/checkbox group
        return "focus_nav";
      }
      const effect = ARROW_X_EFFECT_BY_INPUT_TYPE[target.type];
      if (effect) {
        return effect;
      }
      return "";
    }

    if (key === "ArrowUp" || key === "ArrowDown") {
      if (target.type === "radio" || target.type === "checkbox") {
        // Browser moves focus to the previous/next sibling in the radio/checkbox group
        return "focus_nav";
      }
      const effect = ARROW_Y_EFFECT_BY_INPUT_TYPE[target.type];
      if (effect) {
        return effect;
      }
      return "";
    }

    if (key === "Home" || key === "End") {
      const effect = HOME_END_EFFECT[target.type];
      if (effect) {
        return effect;
      }
      return "";
    }

    if (isTypingIntent(keyboardEvent)) {
      return "type";
    }
    return "";
  }

  if (
    target.tagName === "TEXTAREA" ||
    target.contentEditable === "true" ||
    target.isContentEditable
  ) {
    if (
      key === "ArrowLeft" ||
      key === "ArrowRight" ||
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "Home" ||
      key === "End"
    ) {
      return "cursor_move";
    }
    if (isTypingIntent(keyboardEvent)) {
      return "type";
    }
    return "";
  }

  // Don't handle shortcuts when select dropdown is open
  if (target.tagName === "SELECT") {
    return "";
  }
  return true;
};
const ARROW_X_EFFECT_BY_INPUT_TYPE = {
  "range": "value_change",
  "date": "value_change",
  "time": "value_change",
  "datetime-local": "value_change",
  "month": "value_change",
  "week": "value_change",
  "text": "cursor_move",
  "search": "cursor_move",
  "url": "cursor_move",
  "email": "cursor_move",
  "password": "cursor_move",
  "tel": "cursor_move",
  "number": "cursor_move",
};
const ARROW_Y_EFFECT_BY_INPUT_TYPE = {
  "number": "value_change",
  "range": "value_change",
  "date": "value_change",
  "time": "value_change",
  "datetime-local": "value_change",
  "month": "value_change",
  "week": "value_change",
};
const HOME_END_EFFECT = {
  text: "cursor_move",
  search: "cursor_move",
  url: "cursor_move",
  email: "cursor_move",
  password: "cursor_move",
  tel: "cursor_move",
  number: "cursor_move",
};
const isTypingIntent = (e) => {
  // Modifier keys used for shortcuts: skip
  if (e.metaKey || e.ctrlKey) {
    return false;
  }
  // Shift alone (or Shift+arrow for selection): skip
  // Characters produced with Shift (e.g. uppercase, symbols) are caught below
  // via key.length === 1, so we only need to filter out non-printable Shift combos.
  const { key } = e;
  // Single printable character — the user is typing
  if (key.length === 1) {
    return true;
  }
  // Editing keys that would modify the text
  if (key === "Backspace" || key === "Delete" || key === "Enter") {
    return true;
  }
  return false;
};

export const canInterceptKeyboardEvent = (event, { intent } = {}) => {
  const defaultBehavior = getKeyboardEventDefault(event);
  if (!defaultBehavior) {
    return true;
  }
  if (
    intent === "override_arrow_navigation" &&
    defaultBehavior === "focus_nav"
  ) {
    return true;
  }
  return false;
};
