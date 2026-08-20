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
// screen small enough that its bottom edge stays where the thumb already is.
// Touch alone is not enough — a tall touch screen (a tablet, a kiosk panel)
// docks a sheet a whole screen away from where the finger just tapped, which
// is worse than the centered box it replaced. Both dimensions are bounded: a
// phone is at most ~440 CSS px wide (iPhone Pro Max: 430) and ~930 tall, while
// the smallest tablet already starts around 800 wide — so the width alone
// separates them today, and the height guard is what covers a narrow-but-huge
// screen (a folded panel, a device simulated inside a very tall window).
//
// Read off window, not visualViewport: the virtual keyboard shrinks the visual
// viewport while the user types, and a dialog must not undock mid-interaction
// because a keyboard opened under it.
const SMALL_TOUCH_SCREEN_MAX_WIDTH = 600;
const SMALL_TOUCH_SCREEN_MAX_HEIGHT = 1000;
export const smallTouchScreenSignal = computed(
  () =>
    coarsePointerSignal.value &&
    windowWidthSignal.value <= SMALL_TOUCH_SCREEN_MAX_WIDTH &&
    windowHeightSignal.value <= SMALL_TOUCH_SCREEN_MAX_HEIGHT,
);
