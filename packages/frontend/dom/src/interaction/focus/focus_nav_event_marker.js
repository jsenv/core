import { createEventMarker } from "../event_marker.js";

export const focusNavEventMarker = createEventMarker("focus_nav");

export const preventFocusNav = (event) => {
  focusNavEventMarker.mark(event);
};

export const isFocusNavMarked = (event) => {
  return focusNavEventMarker.isMarked(event);
};
export const markFocusNav = (event) => {
  focusNavEventMarker.mark(event);
};
