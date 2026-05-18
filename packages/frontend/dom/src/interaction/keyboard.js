// Input types where ArrowUp/Down natively change the value — don't intercept them
const INPUT_TYPE_WITH_ARROW_VERTICAL_MEANING_SET = new Set([
  "number",
  "range",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "radio", // moves to the next radios
  "checkbox", // moves to the next checkbox
]);
const INPUT_ALLOWED_KEYS = new Set(["Home", "End", "Escape", "Enter"]);
const TEXTAREA_ALLOWED_KEYS = new Set(["Escape"]);

export const canInterceptKeys = (event, { intent } = {}) => {
  const target = event.target;
  // Allow specific keys on input/textarea/contenteditable elements
  if (target.tagName === "INPUT") {
    if (INPUT_ALLOWED_KEYS.has(event.key)) {
      return true;
    }
    if (intent === "override_arrow_navigation") {
      const isArrowHorizontal =
        event.key === "ArrowLeft" || event.key === "ArrowRight";
      if (isArrowHorizontal) {
        if (target.type === "radio" || target.type === "checkbox") {
          return true;
        }
        return false;
      }
    }
    const isArrowVertical =
      event.key === "ArrowDown" || event.key === "ArrowUp";
    if (isArrowVertical) {
      if (INPUT_TYPE_WITH_ARROW_VERTICAL_MEANING_SET.has(target.type)) {
        // there is something important hapenning for arrow keys on these inputs
        return false;
      }
      return true;
    }
    return false;
  }
  if (
    target.tagName === "TEXTAREA" ||
    target.contentEditable === "true" ||
    target.isContentEditable
  ) {
    return TEXTAREA_ALLOWED_KEYS.has(event.key);
  }
  // Don't handle shortcuts when select dropdown is open
  if (target.tagName === "SELECT") {
    return false;
  }
  // Don't handle shortcuts when target or container is disabled
  if (
    target.disabled ||
    target.closest("[disabled]") ||
    target.inert ||
    target.closest("[inert]")
  ) {
    return false;
  }
  return true;
};
