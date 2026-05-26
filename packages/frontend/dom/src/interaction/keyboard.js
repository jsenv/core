// Input types where ArrowLeft/Right also change the value
const ARROW_X_NAV_INPUT_TYPE_SET = new Set(["range", "radio", "checkbox"]);
// Input types where ArrowUp/Down natively change the value — don't intercept them
const ARROW_Y_NAV_INPUT_TYPE_SET = new Set([
  "number",
  "range",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "radio",
  "checkbox",
]);
// Text-like inputs where cursor navigation keys (arrows, Home, End) move the cursor
const CURSOR_NAV_INPUT_TYPE_SET = new Set([
  "text",
  "search",
  "url",
  "email",
  "password",
  "tel",
  // number/date/etc. also allow cursor navigation inside their value but
  // they are already handled above as "arrow_modifier"
]);
const TEXTAREA_ALLOWED_KEYS = new Set(["Escape"]);

export const getKeyboardEventDefault = (keyboardEvent) => {
  const target = keyboardEvent.target;
  const key = keyboardEvent.key;

  // Nothing special occurs when target or container is disabled/inert
  if (
    target.disabled ||
    target.closest("[disabled]") ||
    target.inert ||
    target.closest("[inert]")
  ) {
    return "";
  }

  const canType =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.contentEditable === "true" ||
    target.isContentEditable;
  if (canType) {
    const isArrowHorizontal = key === "ArrowLeft" || key === "ArrowRight";
    const isArrowVertical = key === "ArrowDown" || key === "ArrowUp";
    if (isArrowHorizontal) {
      if (ARROW_X_NAV_INPUT_TYPE_SET.has(target.type)) {
        return "arrow_nav";
      }
      if (CURSOR_NAV_INPUT_TYPE_SET.has(target.type)) {
        return "arrow_nav";
      }
      return "";
    }
    if (isArrowVertical) {
      if (ARROW_Y_NAV_INPUT_TYPE_SET.has(target.type)) {
        return "arrow_nav";
      }
      return "";
    }
    if (key === "Home" || key === "End") {
      if (CURSOR_NAV_INPUT_TYPE_SET.has(target.type)) {
        return "cursor_nav";
      }
      return "";
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
    defaultBehavior === "arrow_navigation"
  ) {
    return true;
  }
  return false;
};
