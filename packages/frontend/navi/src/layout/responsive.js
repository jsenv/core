import {
  getVirtualKeyboardOverlayHeight,
  subscribeVisualViewportResizeSettled,
  subscribeWindowResizeSettled,
} from "@jsenv/dom";
import { computed, signal } from "@preact/signals";

export const windowWidthSignal = signal(window.innerWidth);
export const windowHeightSignal = signal(window.innerHeight);

// Debounced (not a raw "resize" listener) — see window_size.js's own
// module comment: mobile fires a transient "resize" when the browser's own
// UI chrome (address bar, etc.) briefly shows/hides, and this needs to settle
// on the same tick as Popover/Dialog's own repositioning, or one flickers a
// moment out of sync with the others.
subscribeWindowResizeSettled(() => {
  windowWidthSignal.value = window.innerWidth;
  windowHeightSignal.value = window.innerHeight;
});

// Visual viewport dimensions — update when the virtual keyboard opens/closes or
// when the browser UI (address bar) shows/hides.
// When visualViewport is not available, derived from window signals so they
// stay live without any extra listeners.
const vv = window.visualViewport;
export const visualViewportWidthSignal = vv
  ? signal(vv.width)
  : computed(() => windowWidthSignal.value);
export const visualViewportHeightSignal = vv
  ? signal(vv.height)
  : computed(() => windowHeightSignal.value);

if (vv) {
  const update = () => {
    visualViewportWidthSignal.value = vv.width;
    visualViewportHeightSignal.value = vv.height;
  };
  // The two directions are not equally trustworthy, and treating them alike is
  // what makes one of the two bugs unavoidable.
  //
  // SMALLER is believed at once. Something now covers the screen, and what is
  // sized against these numbers — the dialog/popover ceilings, through
  // --navi-vvh (navi_css_vars.js) — has to answer the smaller screen in the
  // same frame the placement does. The placement reads the viewport live (see
  // getVisibleViewportRect in @jsenv/dom), so a ceiling arriving a debounce
  // later means a box sized for a screen that is gone, placed in the one that
  // replaced it.
  //
  // BIGGER waits for the resize to settle, because growing back is the reading
  // a mobile browser lies about: going straight from one field to the next
  // fires a blur/focus pair that briefly reports the full height again, with
  // the keyboard never having left. Believed, it flicks every popup back to
  // full height and down again between two taps — the "two inputs" case in
  // Dialog's own demo. Nothing is lost by waiting: a keyboard that really left
  // stays gone, and the settled event lands 100ms later.
  vv.addEventListener("resize", () => {
    if (
      vv.width < visualViewportWidthSignal.peek() ||
      vv.height < visualViewportHeightSignal.peek()
    ) {
      update();
    }
  });
  subscribeVisualViewportResizeSettled(update);
  vv.addEventListener("scroll", update);
}

// The app's own screen — the visual viewport, unless the app declared a
// narrower one with --navi-app-max-width/--navi-app-height (see
// navi_css_vars.js, which derives --navi-app-width/--navi-app-height from
// these in CSS). Anything escaping normal flow is sized against this rather
// than the viewport: an app that simulates a handheld screen keeps that width
// even for what paints on top of it.
//
// The declaration stays in CSS and is read back from there rather than handed
// to navi a second time in JS — a JS copy would be the one that goes stale.
// Read on the spot rather than cached in a signal: the only caller is a popup
// resolving its own margin as it places itself, which already reads far more
// of the DOM than this, and nothing then has to be invalidated when the value
// changes.
const unresolvableWarned = new Set();
const readAppMax = (propertyName) => {
  const declared = getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName)
    .trim();
  if (!declared) {
    return Infinity;
  }
  // A custom property computes to a token stream, not to a length: "40rem"
  // arrives here as the string "40rem", and parseFloat would read it as 40
  // pixels. Only px is accepted — an app declaring the screen it simulates has
  // a pixel number to give, and resolving arbitrary lengths would mean laying
  // out a probe element on every read.
  const inPixels = /^([0-9.]+)px$/.exec(declared);
  if (!inPixels) {
    if (!unresolvableWarned.has(propertyName)) {
      unresolvableWarned.add(propertyName);
      // Not silently wrong, just partially applied: CSS still caps the popup's
      // size with the declared length, only the margin it keeps with the edges
      // falls back to a share of the viewport (the pre-token behavior).
      console.warn(
        `${propertyName}="${declared}" must be a length in pixels ("600px"). Until then popups keep viewport-sized margins.`,
      );
    }
    return Infinity;
  }
  return parseFloat(inPixels[1]);
};
export const getAppWidth = () =>
  Math.min(visualViewportWidthSignal.value, readAppMax("--navi-app-max-width"));
// The JS reading of --navi-app-inset-* (see safe_area.js): the centered bands
// between the window's edges and the app's own rectangle. Handed to
// @jsenv/dom (setPlacementViewportInsets, wired in navi_css_vars.js) so
// placement keeps to the same rectangle the CSS size caps describe. The
// keyboard is deliberately absent, unlike in the CSS twin: the placement
// viewport already subtracts the keyboard overlay itself (see
// getVisibleViewportRect in @jsenv/dom's visible_rect.js), so carrying it
// here too would count it twice.
export const getAppInsets = () => {
  const vvWidth = visualViewportWidthSignal.value;
  const vvHeight = visualViewportHeightSignal.value;
  const appMaxWidth = readAppMax("--navi-app-max-width");
  const appMaxHeight = readAppMax("--navi-app-max-height");
  const bandX = appMaxWidth < vvWidth ? (vvWidth - appMaxWidth) / 2 : 0;
  const bandY = appMaxHeight < vvHeight ? (vvHeight - appMaxHeight) / 2 : 0;
  return { left: bandX, top: bandY, right: bandX, bottom: bandY };
};
// Minus what the keyboard covers, so this stays the JS reading of the very
// same rectangle --navi-app-height describes in CSS (see safe_area.js's own
// --navi-keyboard-inset-bottom). Zero unless the app opted into the keyboard
// overlaying its content — otherwise the shrinking visual viewport above has
// already accounted for it, and subtracting again would count it twice.
export const getAppHeight = () =>
  Math.max(
    0,
    Math.min(
      visualViewportHeightSignal.value,
      readAppMax("--navi-app-max-height"),
    ) - getVirtualKeyboardOverlayHeight(),
  );

// Whether the primary input is a finger rather than a mouse. A pointer type is
// not a size: a narrow desktop window is still a mouse, and a large tablet is
// still a finger — so anything sized for the on-screen keyboard must key off
// this, never off windowWidthSignal. Thumb reach needs both, which is what
// smallTouchScreenSignal below answers.
const coarsePointerQuery = window.matchMedia
  ? window.matchMedia("(pointer: coarse)")
  : null;
export const coarsePointerSignal = signal(
  coarsePointerQuery ? coarsePointerQuery.matches : false,
);
if (coarsePointerQuery) {
  coarsePointerQuery.addEventListener("change", () => {
    coarsePointerSignal.value = coarsePointerQuery.matches;
  });
}

// Whether the screen is one a bottom sheet actually suits: a finger *and* a
// screen whose bottom edge stays where the thumb already is. Touch alone is not
// enough — a tall touch screen (a tablet, a kiosk panel) docks a sheet a whole
// screen away from where the finger just tapped, which is worse than the
// centered box it replaced.
//
// A phone is recognized by its SHAPE, not by a box of maximum dimensions: what
// makes the bottom edge reachable is holding a narrow slab, and phones keep
// growing along their long side (20:9, 21:9) while staying just as narrow. So
// each orientation is answered on the short side plus the elongation:
// - upright: narrow enough to be held in one hand, and taller than it is wide.
//   Its height is deliberately unbounded — a very tall narrow screen is the
//   case a bottom sheet is most for, not the case to exclude.
// - on its side: short enough that the bottom edge is a thumb away whatever the
//   width, and wider than it is tall.
// A tablet fails both: it is too wide upright, and too tall on its side — the
// smallest one already starts around 740 CSS px on its short side, and the
// bound below leaves that gap deliberately wide rather than cutting close to
// the largest phone.
//
// Read off window, not visualViewport: the virtual keyboard shrinks the visual
// viewport while the user types, and a dialog must not undock mid-interaction
// because a keyboard opened under it.
const HANDHELD_MAX_SHORT_SIDE = 600;
// Enough elongation to tell a slab from a square-ish panel; a phone is well
// past it (1.7 and up) in either orientation.
const HANDHELD_MIN_RATIO = 1.2;
export const smallTouchScreenSignal = computed(() => {
  if (!coarsePointerSignal.value) {
    return false;
  }
  const width = windowWidthSignal.value;
  const height = windowHeightSignal.value;
  if (width <= HANDHELD_MAX_SHORT_SIDE) {
    return height >= width * HANDHELD_MIN_RATIO;
  }
  if (height <= HANDHELD_MAX_SHORT_SIDE) {
    return width >= height * HANDHELD_MIN_RATIO;
  }
  return false;
});
