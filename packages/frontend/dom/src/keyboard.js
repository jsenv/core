export const canInterceptKeys = (event) => {
  const target = event.target;
  // Don't handle shortcuts when user is typing
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.contentEditable === "true" ||
    target.isContentEditable
  ) {
    return false;
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
