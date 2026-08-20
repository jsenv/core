import {
  subscribeVisualViewportResizeSettled,
  subscribeWindowResizeSettled,
} from "@jsenv/dom";
import { computed, signal } from "@preact/signals";

export const windowWidthSignal = signal(window.innerWidth);
export const windowHeightSignal = signal(window.innerHeight);

// Debounced (not a raw "resize" listener) — see window_size.js's own
// module comment: mobile fires a transient "resize" when the browser's own
// UI chrome (address bar, etc.) briefly shows/hides, and this needs to
// settle on the exact same tick as visualViewport's own debounced resize
// below and Popover/Dialog's own repositioning, or one flickers a moment
// out of sync with the others.
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
export const getAppHeight = () =>
  Math.min(
    visualViewportHeightSignal.value,
    readAppMax("--navi-app-max-height"),
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
