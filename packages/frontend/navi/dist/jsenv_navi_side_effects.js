import { getVirtualKeyboardOverlayHeight, subscribeWindowResizeSettled, subscribeVisualViewportResizeSettled, setVirtualKeyboardOverlaysContent } from "@jsenv/dom";
import { signal, computed, effect } from "@preact/signals";

const installImportMetaCssBuild = (importMeta) => {
  const IMPORT_META_CSS_BUILD = "jsenv_import_meta_css_build";

  if (importMeta.css === IMPORT_META_CSS_BUILD) {
    return;
  }

  const stylesheetMap = new Map();
  const adopt = (url, value) => {
    const stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });
    stylesheet.replaceSync(value);
    stylesheetMap.set(url, stylesheet);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
  };
  const update = (url, value) => {
    stylesheetMap.get(url).replaceSync(value);
  };
  const remove = (url) => {
    const stylesheet = stylesheetMap.get(url);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== stylesheet,
    );
    stylesheetMap.delete(url);
  };

  const currentCssSourceMap = new Map();
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    get() {
      return IMPORT_META_CSS_BUILD;
    },
    set([value, url]) {
      if (value === undefined) {
        if (stylesheetMap.has(url)) {
          remove(url);
          currentCssSourceMap.delete(url);
        }
        return;
      }
      if (!stylesheetMap.has(url)) {
        adopt(url, value);
        currentCssSourceMap.set(url, value);
      } else if (currentCssSourceMap.get(url) !== value) {
        update(url, value);
        currentCssSourceMap.set(url, value);
      }
    },
  });
};

const windowWidthSignal = signal(window.innerWidth);
const windowHeightSignal = signal(window.innerHeight);

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
const visualViewportWidthSignal = vv
  ? signal(vv.width)
  : computed(() => windowWidthSignal.value);
const visualViewportHeightSignal = vv
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
const getAppWidth = () =>
  Math.min(visualViewportWidthSignal.value, readAppMax("--navi-app-max-width"));
// Minus what the keyboard covers, so this stays the JS reading of the very
// same rectangle --navi-app-height describes in CSS (see safe_area.js's own
// --navi-keyboard-inset-bottom). Zero unless the app opted into the keyboard
// overlaying its content — otherwise the shrinking visual viewport above has
// already accounted for it, and subtracting again would count it twice.
const getAppHeight = () =>
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
const coarsePointerSignal = signal(
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
const smallTouchScreenSignal = computed(() => {
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

installImportMetaCssBuild(import.meta);/**
 * The part of the window an app actually has, in two levels.
 *
 * Two, and not one, for a reason worth stating up front: a fixed bar is one of
 * the things that reduce the free region, so it cannot ALSO be placed against
 * that region — it would push itself off the edge it is pinned to. What is
 * anchored and what is anchored-inside are two different rectangles.
 *
 * 1. `--navi-app-inset-{top,right,bottom,left}` — from the window's edges to
 *    the app's own rectangle. Whatever is pinned to an edge (a fixed bar, a
 *    side panel, a popup aimed at a corner) is pinned to THAT, so an app
 *    pretending to be a 600px handheld inside a 1500px window stays one
 *    rectangle instead of a column with its furniture spread across the glass.
 *
 * 2. `--navi-safe-area-inset-{top,right,bottom,left}` — from the window's edges
 *    to the band left free INSIDE that rectangle. Whatever flows, scrolls, or
 *    gets painted keeps to it.
 *
 * Level 2 is a sum, and the contract for taking part in it is only "publish
 * what you take on one edge": the device's own notch (`env(safe-area-inset-*)`,
 * which is the browser's version of this very idea), the fixed bars
 * (fixed_bar_space.js), and anything an app adds. That is the point of naming
 * it at all — a component that must stay clear of what covers the screen reads
 * ONE set of numbers, and never has to learn what is covering it.
 *
 * `max()` between the notch and the bars rather than a sum: a bar pinned to an
 * edge already reaches under the notch and counts it in its own size (see
 * fixed_bar.jsx), so adding both would reserve it twice.
 *
 * Sizes only, not placement, for the time being — see "Current limitations" in
 * docs/css_architecture.md.
 */

const SAFE_AREA_CSS = /* css */`@property --navi-safe-area-inset-top {
  syntax: "<length>";
  inherits: true;
  initial-value: 0;
}

@property --navi-safe-area-inset-right {
  syntax: "<length>";
  inherits: true;
  initial-value: 0;
}

@property --navi-safe-area-inset-bottom {
  syntax: "<length>";
  inherits: true;
  initial-value: 0;
}

@property --navi-safe-area-inset-left {
  syntax: "<length>";
  inherits: true;
  initial-value: 0;
}

@layer navi {
  :root {
    --navi-fixed-bar-space-top: 0px;
    --navi-fixed-bar-space-right: 0px;
    --navi-fixed-bar-space-bottom: 0px;
    --navi-fixed-bar-space-left: 0px;
    --navi-keyboard-inset-bottom: env(keyboard-inset-height, 0px);
    --navi-app-inset-top: max(0px,
        (var(--navi-vvh) - var(--navi-app-max-height, var(--navi-vvh))) / 2);
    --navi-app-inset-bottom: calc(var(--navi-app-inset-top) + var(--navi-keyboard-inset-bottom));
    --navi-app-inset-left: max(0px,
        (var(--navi-vvw) - var(--navi-app-max-width, var(--navi-vvw))) / 2);
    --navi-app-inset-right: var(--navi-app-inset-left);
    --navi-safe-area-inset-top: calc(var(--navi-app-inset-top) +
          max(env(safe-area-inset-top), var(--navi-fixed-bar-space-top)));
    --navi-safe-area-inset-right: calc(var(--navi-app-inset-right) +
          max(env(safe-area-inset-right), var(--navi-fixed-bar-space-right)));
    --navi-safe-area-inset-bottom: calc(var(--navi-app-inset-bottom) +
          max(env(safe-area-inset-bottom), var(--navi-fixed-bar-space-bottom)));
    --navi-safe-area-inset-left: calc(var(--navi-app-inset-left) +
          max(env(safe-area-inset-left), var(--navi-fixed-bar-space-left)));
    scroll-padding-top: var(--navi-safe-area-inset-top);
    scroll-padding-right: var(--navi-safe-area-inset-right);
    scroll-padding-bottom: var(--navi-safe-area-inset-bottom);
    scroll-padding-left: var(--navi-safe-area-inset-left);
  }

  [data-navi-safe-area] {
    padding-top: var(--navi-safe-area-inset-top);
    padding-right: var(--navi-safe-area-inset-right);
    padding-bottom: var(--navi-safe-area-inset-bottom);
    padding-left: var(--navi-safe-area-inset-left);
    scroll-padding-top: var(--navi-safe-area-inset-top);
    scroll-padding-right: var(--navi-safe-area-inset-right);
    scroll-padding-bottom: var(--navi-safe-area-inset-bottom);
    scroll-padding-left: var(--navi-safe-area-inset-left);
  }
}
`;
import.meta.css = [SAFE_AREA_CSS, "@jsenv/navi/src/layout/safe_area.js"];

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


setVirtualKeyboardOverlaysContent(true);

const disableVirtualKeyboardOverlay = () => {
  setVirtualKeyboardOverlaysContent(false);
};

installImportMetaCssBuild(import.meta);/**
 * Regroup CSS vars that makes sense to share across all navi components.
 */
const button = document.createElement("button");
button.style.display = "none";
document.body.appendChild(button);
const computedStyle = getComputedStyle(button);
const controlDefaultFontFamily = computedStyle.fontFamily;
const controlDefaultFontSize = computedStyle.fontSize;
document.body.removeChild(button);
const css = /* css */`@layer navi {
  :root {
    --navi-vvw: 100dvw;
    --navi-vvh: 100dvh;
    --navi-app-width: calc(var(--navi-vvw) - var(--navi-app-inset-left) - var(--navi-app-inset-right));
    --navi-app-height: calc(var(--navi-vvh) - var(--navi-app-inset-top) - var(--navi-app-inset-bottom));
    --navi-focus-outline-width: 2px;
    --navi-focus-outline-color: light-dark(#4476ff, #3b82f6);
    --navi-loader-color: light-dark(#355fcc, #3b82f6);
    -webkit-tap-highlight-color: var(--navi-tap-highlight-color);
    --navi-tap-highlight-color: transparent;
    --navi-control-font-family: ${controlDefaultFontFamily};
    --navi-control-font-size: ${controlDefaultFontSize};
    --navi-control-border-radius: 2px;
    --navi-checkbox-border-radius: min(var(--navi-control-border-radius),
        .25em);
    --navi-control-accent-color: light-dark(#1875ff, #3b82f6);
    --navi-control-border-width: 1px;
    --navi-control-border-color: light-dark(#767676, #8e8e93);
    --navi-control-padding-x-default: 2px;
    --navi-control-padding-y-default: 1px;
    --navi-button-padding-x-default: 6px;
    --navi-button-padding-y-default: 1px;
    --navi-button-background-color: light-dark(#f3f4f6, #2d3748);
    --navi-callout-success-color: #4caf50;
    --navi-callout-info-color: #2196f3;
    --navi-callout-warning-color: #ff9800;
    --navi-callout-error-color: #f44336;
    --navi-callout-neutral-color: var(--navi-control-border-color);
    --navi-list-item-padding-x-default: 4px;
    --navi-list-item-padding-y-default: 1px;
    --navi-picker-padding-x-default: var(--navi-control-padding-x-default);
    --navi-picker-padding-y-default: var(--navi-control-padding-y-default);
    --navi-popup-border-radius: 8px;
    --navi-popup-border-color: light-dark(#d0d0d0, #3b3b3b);
    --navi-popup-box-shadow: 0 4px 8px #00000014, 0 12px 40px #00000038;
    --navi-popup-background-color: var(--navi-surface-color);
    --navi-popup-color: var(--navi-surface-text-color);
    --navi-backdrop-close-background: #00000014;
    --navi-backdrop-discrete-background: #00000005;
    --navi-backdrop-capture-background: #ffffff14;
    --navi-backdrop-capture-backdrop-filter: blur(30px) saturate(180%);
    --navi-link-color: #00e;
    --navi-link-color-pressed: red;
    --navi-link-current-indicator-color: #cd3425;
    --navi-selection-border-color: #0078d4;
    --navi-selection-background-color: #eaf1fd;
    --navi-accent-color: #031e3c;
    --navi-surface-color: light-dark(#fff, #1c1c1e);
    --navi-surface-text-color: CanvasText;
    --navi-separator-color-default: #d1d9e0;
    --navi-color-white: white;
    --navi-color-dark: #373c45;
    --navi-info-color-light: #eaf6fc;
    --navi-info-color: #376cc2;
    --navi-success-color-light: #ecf9ef;
    --navi-success-color: #50c464;
    --navi-warning-color-light: #fdf6e3;
    --navi-warning-color: #f19c05;
    --navi-error-color-light: #fcebed;
    --navi-error-color: #eb364b;
    --navi-xxs: .125em;
    --navi-xs: .25em;
    --navi-s: .5em;
    --navi-m: 1em;
    --navi-l: 1.5em;
    --navi-xl: 2em;
    --navi-xxl: 3em;
    --navi-typo-xxs: .625rem;
    --navi-typo-xs: .75rem;
    --navi-typo-s: .875rem;
    --navi-typo-m: 1rem;
    --navi-typo-l: 1.125rem;
    --navi-typo-xl: 1.25rem;
    --navi-typo-xxl: 1.5rem;
    --navi-line-height: 1.25;
    line-height: var(--navi-line-height);
    --navi-control-line-height: round(calc(var(--navi-line-height) * 1em),
        1px);
    --navi-color-secondary-mix: 80%;
    --navi-color-emphasis-mix: 50%;
    --navi-color-discrete-mix: 60%;
    --navi-color-hint-mix: 25%;
    --navi-color-primary: var(--navi-surface-text-color);
    --navi-placeholder-color: var(--navi-color-discrete);
    --navi-placeholder-font-style: normal;
  }

  .navi_popover, .navi_dialog {
    --navi-color-primary: var(--navi-popup-color);
  }

  .navi_callout {
    --navi-color-primary: CanvasText;
  }

  :root, .navi_popover, .navi_dialog, .navi_callout {
    --navi-color-secondary: color-mix(in srgb,
        currentColor var(--navi-color-secondary-mix),
        transparent);
    --navi-color-emphasis: color-mix(in srgb,
        currentColor var(--navi-color-emphasis-mix),
        black);
    --navi-color-discrete: color-mix(in srgb,
        currentColor var(--navi-color-discrete-mix),
        transparent);
    --navi-color-hint: color-mix(in srgb,
        currentColor var(--navi-color-hint-mix),
        transparent);
  }
}

input[navi-visually-hidden], button[navi-visually-hidden], div[navi-visually-hidden] {
  z-index: -1;
  white-space: nowrap;
  clip-path: inset(50%);
  appearance: none;
  border: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;

  &[navi-debug] {
    clip-path: none;
    appearance: auto;
    width: auto;
    height: auto;
    margin: 0;
    position: static;
  }
}
`;
import.meta.css = [css, "@jsenv/navi/src/navi_css_vars.js"];
effect(() => {
  document.documentElement.style.setProperty("--navi-vvw", `${visualViewportWidthSignal.value}px`);
  document.documentElement.style.setProperty("--navi-vvh", `${visualViewportHeightSignal.value}px`);
});

export { coarsePointerSignal, disableVirtualKeyboardOverlay, getAppHeight, getAppWidth, installImportMetaCssBuild, smallTouchScreenSignal, visualViewportHeightSignal, visualViewportWidthSignal, windowHeightSignal, windowWidthSignal };
//# sourceMappingURL=jsenv_navi_side_effects.js.map
