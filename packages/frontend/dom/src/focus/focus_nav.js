import { preventFocusNav } from "./focus_nav_event_marker.js";

export const preventFocusNavViaKeyboard = (keyboardEvent) => {
  if (keyboardEvent.key === " ") {
    // prevent space to scroll
    keyboardEvent.preventDefault();
    return true;
  }
  // ensure we won't perform our internal focus nav in focus groups
  preventFocusNav(keyboardEvent);
  return false;
};
