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
 * The one thing it hands back to the app: scrolling the focused field into
 * view. A viewport that shrinks makes the browser do it; a keyboard that
 * merely paints over the page leaves whatever is under it under it. navi
 * answers that for what it places itself — a popup is sized and positioned
 * against the app rectangle the keyboard was just subtracted from — and for
 * anything marked [data-navi-safe-area], whose scroll-padding-bottom counts
 * the keyboard in (safe_area.js). A field in a scroller the app never marked
 * is the app's own to handle.
 */

import { setVirtualKeyboardOverlaysContent } from "@jsenv/dom";

setVirtualKeyboardOverlaysContent(true);

export const disableVirtualKeyboardOverlay = () => {
  setVirtualKeyboardOverlaysContent(false);
};
