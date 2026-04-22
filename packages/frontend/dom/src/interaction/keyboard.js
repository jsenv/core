// Input types where ArrowUp/Down natively change the value — don't intercept them
const INPUT_TYPES_WITH_ARROW_MEANING = new Set([
  "number",
  "range",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
]);
const INPUT_ALLOWED_KEYS = new Set(["Home", "End", "Escape", "Enter"]);
const INPUT_ARROW_KEYS = new Set(["ArrowDown", "ArrowUp"]);
const TEXTAREA_ALLOWED_KEYS = new Set(["Escape"]);

export const canInterceptKeys = (event) => {
  const target = event.target;
  // Allow specific keys on input/textarea/contenteditable elements
  if (target.tagName === "INPUT") {
    if (INPUT_ALLOWED_KEYS.has(event.key)) {
      return true;
    }
    if (INPUT_ARROW_KEYS.has(event.key)) {
      return !INPUT_TYPES_WITH_ARROW_MEANING.has(target.type);
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
