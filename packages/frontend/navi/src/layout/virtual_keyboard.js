/**
 * navi's stance on the on-screen keyboard: it overlays the app rather than
 * resizing the viewport, wherever the browser can be told so (the
 * VirtualKeyboard API — Chromium only). See virtual_keyboard.js in @jsenv/dom
 * for what that trades away and what it gives back.
 *
 * Turned on rather than offered, because navi already sizes everything that
 * escapes normal flow against the app's own rectangle rather than against the
 * window (--navi-app-width/height, see navi_css_vars.js), and
 * --navi-keyboard-inset-bottom (safe_area.js) puts the keyboard into exactly
 * that rectangle. So the two mechanisms reach the same numbers here, and the
 * overlay reaches them without reflowing the page underneath — a resizing
 * viewport is a resize of everything, fired transiently every time focus goes
 * from one input to the next.
 *
 * An app that built its own layout around the viewport shrinking can say so
 * with disableVirtualKeyboardOverlay(), and gets the behavior Firefox and
 * Safari give it anyway.
 *
 * Taking the deal means taking over what the browser stops doing under it:
 * bringing the focused field out from under the keyboard. A viewport that
 * shrinks makes the browser scroll to the field; a keyboard that merely paints
 * over the page leaves whatever is under it under it. So navi does that
 * scroll here, with three things safe_area.js provides: a
 * scroll-padding-bottom that counts the keyboard in, which bounds the band the
 * field is brought into; room at the end of the scroller, so a field near the
 * end of the page has somewhere to go; and an allowance for the strip Chrome
 * paints above the keyboard without reporting it
 * (--navi-keyboard-strip-allowance).
 */

import {
  getVirtualKeyboardOverlayHeight,
  scrollIntoViewThroughScrollables,
  setVirtualKeyboardOverlaysContent,
  subscribeVirtualKeyboardGeometryChange,
} from "@jsenv/dom";

import { isEditableTarget } from "../box/pseudo_styles.js";

setVirtualKeyboardOverlaysContent(true);

export const disableVirtualKeyboardOverlay = () => {
  setVirtualKeyboardOverlaysContent(false);
};

const revealFocusedField = () => {
  // 0 as well once the overlay is disabled: the viewport shrinks and the
  // browser reveals the field itself.
  if (getVirtualKeyboardOverlayHeight() === 0) {
    return;
  }
  const field = document.activeElement;
  if (!isEditableTarget(field)) {
    return;
  }
  if (isInDocumentBand(field)) {
    return;
  }
  // "center" rather than "nearest": nearest stops the field on the edge the
  // keyboard reports, which is under the strip Chrome paints above it. The
  // middle of the band clears the strip whatever its height — and centering
  // what is not fully visible is what Chrome does itself when the viewport
  // shrinks.
  scrollIntoViewThroughScrollables(field, {
    block: "center",
    behavior: "instant",
  });
};
// The keyboard rising, or changing height (suggestion strip, emoji panel).
subscribeVirtualKeyboardGeometryChange(revealFocusedField);
// From one field to the next with the keyboard up: when both want the same
// keyboard it does not move, and no geometrychange fires.
document.addEventListener("focusin", revealFocusedField, { capture: true });

// The band the document leaves visible: inside its scroll-padding (the bars,
// the keyboard as reported, see safe_area.js), and above the strip nothing
// reports. Against the window rather than each scroller's own band: the
// keyboard covers the window, and a field hidden inside its own scroller is
// what the browser's focus already scrolls to.
const isInDocumentBand = (field) => {
  const documentElement = document.documentElement;
  const style = getComputedStyle(documentElement);
  const bandTop = parseFloat(style.scrollPaddingTop) || 0;
  const bandBottom =
    documentElement.clientHeight -
    (parseFloat(style.scrollPaddingBottom) || 0) -
    parseFloat(style.getPropertyValue("--navi-keyboard-strip-allowance"));
  const { top, bottom } = field.getBoundingClientRect();
  return top >= bandTop && bottom <= bandBottom;
};
