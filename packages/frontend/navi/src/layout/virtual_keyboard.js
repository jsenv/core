/**
 * The on-screen keyboard overlaying the app rather than resizing the viewport,
 * for an app that asks for it (the VirtualKeyboard API — Chromium only). See
 * virtual_keyboard.js in @jsenv/dom for what that trades away and what it
 * gives back.
 *
 * Offered, never taken by default. Overlaying means redoing by hand what the
 * browser does for a viewport that shrinks, and on a phone every piece of it
 * hid a Chrome behavior nothing reports: the focused field left under the
 * keyboard, a suggestion strip painted above the keyboard outside its
 * geometry, geometrychange firing while the page is merely scrolled. Firefox
 * and Safari shrink the viewport whatever the app wants, and navi follows that
 * already (--navi-vvh), so the default is the path every browser shares.
 *
 * What the overlay buys: no reflow of the page underneath — a resizing
 * viewport is a resize of everything, fired transiently every time focus goes
 * from one input to the next — while navi still sizes what escapes normal flow
 * against a rectangle the keyboard is subtracted from
 * (--navi-keyboard-inset-bottom, safe_area.js).
 *
 * Taking the deal means taking over what the browser stops doing under it:
 * bringing the focused field out from under the keyboard. A viewport that
 * shrinks makes the browser scroll to the field; a keyboard that merely paints
 * over the page leaves whatever is under it under it. So enabling the overlay
 * also installs that scroll, with two things safe_area.js provides: a
 * scroll-padding-bottom that counts the keyboard in, plus an allowance for the
 * strip Chrome paints above it without reporting it
 * (--navi-keyboard-strip-allowance), which bounds the band the field is brought
 * into; and room at the end of the scroller, so a field near the end of the
 * page has somewhere to go. All of it reads 0 while the keyboard does not
 * overlay.
 *
 * Only the arrival is navi's: once the field is in view, Chrome keeps the caret
 * there itself as typing grows a textarea, against that same
 * scroll-padding-bottom.
 */

import {
  getVirtualKeyboardOverlayHeight,
  scrollIntoViewThroughScrollables,
  setVirtualKeyboardOverlaysContent,
  subscribeVirtualKeyboardGeometryChange,
} from "@jsenv/dom";

import { isEditableTarget } from "../box/pseudo_styles.js";

/**
 * Makes the on-screen keyboard overlay the app instead of shrinking the
 * viewport, and brings the focused field out from under it. A no-op on
 * Firefox/Safari, which have no VirtualKeyboard API.
 *
 * @returns {() => void} Goes back to the viewport shrinking.
 */
export const enableVirtualKeyboardOverlay = () => {
  if (!setVirtualKeyboardOverlaysContent(true)) {
    return () => {};
  }
  // The keyboard rising, or changing height (suggestion strip, emoji panel).
  const unsubscribeGeometryChange =
    subscribeVirtualKeyboardGeometryChange(revealFocusedField);
  // From one field to the next with the keyboard up: when both want the same
  // keyboard it does not move, and no geometrychange fires.
  document.addEventListener("focusin", revealFocusedField, { capture: true });
  return () => {
    unsubscribeGeometryChange();
    document.removeEventListener("focusin", revealFocusedField, {
      capture: true,
    });
    setVirtualKeyboardOverlaysContent(false);
  };
};

const revealFocusedField = () => {
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
  // "center" rather than "nearest": nearest stops the field on the band's
  // edge, clear of the strip only by the allowance. The middle of the band
  // clears a strip taller than guessed too — and centering what is not fully
  // visible is what Chrome does itself when the viewport shrinks.
  scrollIntoViewThroughScrollables(field, {
    block: "center",
    behavior: "instant",
  });
};
// The band the document leaves visible: inside its scroll-padding (the bars,
// the keyboard and its strip, see safe_area.js). Against the window rather
// than each scroller's own band: the keyboard covers the window, and a field
// hidden inside its own scroller is what the browser's focus already scrolls
// to.
const isInDocumentBand = (field) => {
  const documentElement = document.documentElement;
  const style = getComputedStyle(documentElement);
  const bandTop = parseFloat(style.scrollPaddingTop) || 0;
  const bandBottom =
    documentElement.clientHeight - (parseFloat(style.scrollPaddingBottom) || 0);
  const { top, bottom } = field.getBoundingClientRect();
  return top >= bandTop && bottom <= bandBottom;
};
