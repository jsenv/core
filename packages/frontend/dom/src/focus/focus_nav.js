export const preventFocusNavViaKeyboard = (keyboardEvent) => {
  if (keyboardEvent.key === " ") {
    // prevent space to scroll
    keyboardEvent.preventDefault();
    return true;
  }
  // prevent arrow keys to scroll according to stuff
  if (keyboardEvent.key === "ArrowUp" || keyboardEvent.key === "ArrowDown") {
    keyboardEvent.preventDefault();
    return true;
  }
  return false;
};
