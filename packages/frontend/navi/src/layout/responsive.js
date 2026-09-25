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

// The app's own screen: the visual viewport minus the bands --navi-app-inset-*
// describes (see safe_area.js, and navi_css_vars.js, which derives
// --navi-app-width/--navi-app-height from the same bands in CSS). Anything
// escaping normal flow is sized and placed against this rather than the
// viewport: an app that simulates a handheld screen keeps that width even for
// what paints on top of it.
//
// The bands are read back from CSS rather than worked out again here: a JS
// copy of the formula is the one that goes stale, and it only knows the
// centered bands --navi-app-max-width/height produce, not the uneven ones an
// app writes directly. They are registered as lengths (safe_area.js), so they
// compute to pixels whatever unit they were declared in. Read on the spot
// rather than cached in a signal: the callers are a popup resolving its margin
// and placing itself, which already read far more of the DOM than this, and
// nothing then has to be invalidated when the value changes.
const readAppInsets = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  return {
    top: readAppInset(computedStyle, "top"),
    right: readAppInset(computedStyle, "right"),
    bottom: readAppInset(computedStyle, "bottom"),
    left: readAppInset(computedStyle, "left"),
  };
};
const readAppInset = (computedStyle, side) => {
  const value = parseFloat(
    computedStyle.getPropertyValue(`--navi-app-inset-${side}`),
  );
  // A browser that cannot register a custom property hands back the calc()
  // it was written as: JS then answers for the whole viewport.
  return Number.isFinite(value) ? value : 0;
};
export const getAppWidth = () => {
  const { left, right } = readAppInsets();
  return visualViewportWidthSignal.value - left - right;
};
// Handed to @jsenv/dom (setPlacementViewportInsets, wired in navi_css_vars.js)
// so placement keeps to the same rectangle the CSS size caps describe. The
// keyboard is taken back off the bottom band: --navi-app-inset-bottom counts
// it, and the placement viewport already subtracts it (see
// getVisibleViewportRect in @jsenv/dom's visible_rect.js), so it would count
// twice.
export const getAppInsets = () => {
  const insets = readAppInsets();
  insets.bottom -= getVirtualKeyboardOverlayHeight();
  return insets;
};
// The keyboard stays in: this is --navi-app-height, which the ceilings are
// sized against, read in JS.
export const getAppHeight = () => {
  const { top, bottom } = readAppInsets();
  const height = visualViewportHeightSignal.value - top - bottom;
  if (height < 0) {
    return 0;
  }
  return height;
};

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
