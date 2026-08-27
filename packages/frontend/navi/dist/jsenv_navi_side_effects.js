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

/**
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

const SAFE_AREA_CSS = /* css */ `
  @layer navi {
    :root {
      /* The room each kind of furniture takes, declared here at zero and
         written by whoever takes it. A slot rather than a value: the sum below
         has to be readable whether or not the app ever mounts a fixed bar. */
      --navi-fixed-bar-space-top: 0px;
      --navi-fixed-bar-space-right: 0px;
      --navi-fixed-bar-space-bottom: 0px;
      --navi-fixed-bar-space-left: 0px;

      /* What the on-screen keyboard covers — and ONLY where it overlays the
         content rather than shrinking the viewport, which is navi's default
         wherever the browser has the VirtualKeyboard API (see
         layout/virtual_keyboard.js). Zero on Firefox/Safari, which have no
         such API, and zero for an app that called
         disableVirtualKeyboardOverlay(): both get a keyboard that shrinks the
         visual viewport instead, which --navi-vvh already tracks. Reading
         env() rather than a JS-written value keeps it live: the keyboard
         slides in over several frames and this follows it without a
         listener. */
      --navi-keyboard-inset-bottom: env(keyboard-inset-height, 0px);

      /* Level 1. Centered bands, so that declaring one ceiling
         (--navi-app-max-width) is all an app has to do to be a narrow screen in
         a wide window; an app that wants them uneven writes these directly. */
      --navi-app-inset-top: max(
        0px,
        (var(--navi-vvh) - var(--navi-app-max-height, var(--navi-vvh))) / 2
      );
      /* The keyboard on top of the band, and on this edge only: it eats into
         the app's own rectangle exactly like a viewport that shrank, which is
         what makes both paths end up at the same --navi-app-height (and so at
         the same dialog/popover ceiling). Not part of the centering, hence
         added here rather than folded into --navi-app-inset-top: a keyboard
         takes the bottom, it doesn't re-center anything. */
      --navi-app-inset-bottom: calc(
        var(--navi-app-inset-top) + var(--navi-keyboard-inset-bottom)
      );
      --navi-app-inset-left: max(
        0px,
        (var(--navi-vvw) - var(--navi-app-max-width, var(--navi-vvw))) / 2
      );
      --navi-app-inset-right: var(--navi-app-inset-left);

      /* Level 2. */
      --navi-safe-area-inset-top: calc(
        var(--navi-app-inset-top) +
          max(env(safe-area-inset-top), var(--navi-fixed-bar-space-top))
      );
      --navi-safe-area-inset-right: calc(
        var(--navi-app-inset-right) +
          max(env(safe-area-inset-right), var(--navi-fixed-bar-space-right))
      );
      --navi-safe-area-inset-bottom: calc(
        var(--navi-app-inset-bottom) +
          max(env(safe-area-inset-bottom), var(--navi-fixed-bar-space-bottom))
      );
      --navi-safe-area-inset-left: calc(
        var(--navi-app-inset-left) +
          max(env(safe-area-inset-left), var(--navi-fixed-bar-space-left))
      );

      /* The document is the scrollport in the common case, and something the
         browser scrolls to — an anchor, a focused field, a restored position —
         landing under a bar is never what anyone wants. */
      scroll-padding-top: var(--navi-safe-area-inset-top);
      scroll-padding-right: var(--navi-safe-area-inset-right);
      scroll-padding-bottom: var(--navi-safe-area-inset-bottom);
      scroll-padding-left: var(--navi-safe-area-inset-left);
    }

    /* Put this on whatever scrolls under the furniture.

       There are TWO rooms to give back, and forgetting the second one is the
       classic bug:

       - padding, so the end of the content can be scrolled out from under it.
         Without it the last screenful stays covered, unreachable.
       - scroll-padding, so anything the browser scrolls TO lands in front of it
         rather than under. The padding above does not help here: it moves the
         content, not the place the browser scrolls the target to.

       Marked by the app rather than picked by navi: which element scrolls is
       the app's business, and an app with more than one would have to fight a
       component that chose for it. An app is free to read the variables itself
       instead. */
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
const css = /* css */`
  @layer navi {
    :root {
      /* Overridden at runtime with precise VisualViewport pixel values so that dvw/dvh 
      (which don't track the virtual keyboard dimensions) are never used in practice on supported browsers. */
      --navi-vvw: 100dvw;
      --navi-vvh: 100dvh;

      /* What navi treats as "the screen" when it sizes something that escapes
         normal flow (a dialog in the top layer, a popover, anything built on
         them): the app's own rectangle, which is the visual viewport minus the
         bands an app asks for. An app that never spans the whole window says so
         ONCE, without ever naming a component:

           :root {
             --navi-app-max-width: 600px;
           }

         In pixels — see readAppMax in layout/responsive.js for why.

         Typically an app simulating a handheld screen: a column centered in a
         wide window with bands on the sides. A dialog is in the top layer, so
         it answers to the viewport, not to that column — left alone it would
         paint 1500px of modal over a 600px app. Declaring the ceiling here is
         what makes the app's own width apply everywhere, including on top.

         It stays a ceiling and nothing else: on a screen narrower than the app
         it never binds, so popups keep shrinking with the phone, and the gap
         each popup keeps with the edges (marginWithContainer) is subtracted
         from it as before. A single popup that genuinely needs more can still
         raise its own maxWidth/maxHeight prop.

         Read from the insets rather than as a min() of its own so that the
         width and the placement come from ONE description of where the app is
         (see layout/safe_area.js). Placement does not follow yet everywhere —
         see "Current limitations" in docs/css_architecture.md. */
      --navi-app-width: calc(
        var(--navi-vvw) - var(--navi-app-inset-left) - var(
            --navi-app-inset-right
          )
      );
      --navi-app-height: calc(
        var(--navi-vvh) - var(--navi-app-inset-top) - var(
            --navi-app-inset-bottom
          )
      );

      --navi-focus-outline-width: 2px;
      --navi-focus-outline-color: light-dark(#4476ff, #3b82f6);
      --navi-loader-color: light-dark(#355fcc, #3b82f6);
      --navi-control-tap-highlight-color: transparent;

      --navi-control-font-family: ${controlDefaultFontFamily};
      --navi-control-font-size: ${controlDefaultFontSize};
      --navi-control-border-radius: 2px;
      /* A checkbox is only ~1em wide: applying a control radius meant for
         buttons/inputs (say 8px) would turn it into a circle and make it read
         as a radio. So it follows the control radius but capped at a quarter
         of its own size. Override this token alone to opt out of the cap. */
      --navi-checkbox-border-radius: min(
        var(--navi-control-border-radius),
        0.25em
      );
      /* The color a control uses to say "this one is on": a checked checkbox,
         a checked radio, an enabled switch. Kept apart from --navi-accent-color
         (the brand color for CTA and selection) because a control that is on
         must stay readable as a control, which usually means a brighter, more
         saturated color than a brand accent.
         The light value matches the browser's own accent so a navi control and
         a native one can sit side by side without reading as two blues. */
      --navi-control-accent-color: light-dark(rgb(24, 117, 255), #3b82f6);
      --navi-control-border-width: 1px;
      --navi-control-border-color: light-dark(#767676, #8e8e93);
      --navi-control-padding-x-default: 2px;
      --navi-control-padding-y-default: 1px;
      /* Global padding defaults — override these to change all button paddings. */
      /* Use --button-padding, --button-padding-x, --button-padding-y for per-button overrides. */
      --navi-button-padding-x-default: 6px;
      --navi-button-padding-y-default: 1px;
      /* Read by Button, and by whatever is drawn as one (a picker under
         variant="button"), so the two keep the same surface. */
      --navi-button-background-color: light-dark(#f3f4f6, #2d3748);
      /* For list item we need slightly more padding to be able to see radio/checkbox outline */
      --navi-list-item-padding-x-default: 4px;
      --navi-list-item-padding-y-default: 1px;
      /* default */
      --navi-picker-padding-x-default: var(--navi-control-padding-x-default);
      --navi-picker-padding-y-default: var(--navi-control-padding-y-default);

      --navi-popup-border-radius: 8px;
      --navi-popup-border-color: light-dark(#d0d0d0, #3b3b3b);
      --navi-popup-box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.08), 0 12px 40px rgba(0, 0, 0, 0.22);
      /* A popup's paper is the same paper as everything else's: derived from
         the surface token so one override themes fields, layouts and popups
         together. Still its own token, so popups alone can be re-papered. */
      --navi-popup-background-color: var(--navi-surface-color);
      /* The ink written on that paper. A popup declares both on itself (see
         dialog.jsx / popover.jsx): it is a new surface, so it does not write
         in whatever the container it was declared in writes in. */
      --navi-popup-color: var(--navi-surface-text-color);
      --navi-backdrop-close-background: rgba(0, 0, 0, 0.08);
      /* backdropVariant="discrete": the popup still catches every outside
         click, it just stops announcing that it did. For an affordance one
         reaches past rather than through — the dim is there to mark the layer,
         not to push the page behind it away. */
      --navi-backdrop-discrete-background: rgba(0, 0, 0, 0.02);
      /* "capture" means the rest of the page is fully non-interactive —
         blurred, not just dimmed, so it reads as clearly secondary and
         pulls visual focus onto the popover's own content. */
      --navi-backdrop-capture-background: rgb(255 255 255 / 0.08);
      --navi-backdrop-capture-backdrop-filter: blur(30px) saturate(180%);

      /* Link colors. They live here rather than only on .navi_link because a
         var declared on the element itself always beats the same var inherited
         from an ancestor: a page setting --link-color-pressed on :root would
         never reach a link. These :root tokens are the theme-level surface;
         --link-color-* stays the per-link (or per-subtree) override. */
      --navi-link-color: rgb(0, 0, 238);
      /* --navi-link-color-visited is intentionally left undefined: by default a
         visited link is derived from whatever --link-color ended up being on
         the link itself (see link.jsx), which a :root token cannot see. Set it
         here from an app to pin one visited color for every link. */
      --navi-link-color-pressed: red;
      --navi-link-current-indicator-color: rgb(205, 52, 37);

      --navi-selection-border-color: #0078d4;
      --navi-selection-background-color: #eaf1fd;
      /* Accent color — used for call-to-action buttons and selected list items.
         Override this single variable to apply a consistent brand color across
         all components that need to stand out. */
      --navi-accent-color: rgb(3, 30, 60);
      /* The surface a control's content sits on — the "paper" behind the text.
         Fields use it whenever they need a solid background (their default
         background, a transparent field being edited, …). */
      --navi-surface-color: light-dark(#ffffff, #1c1c1e);
      /* What is written on that paper. The browser's own text color rather
         than a literal, so it follows color-scheme the way the paper does. */
      --navi-surface-text-color: CanvasText;
      /* The line that separates two regions of one surface — a scrolling area's
         header from what scrolls under it, for instance. Not a border: the
         separation belongs to the layout, not to the box that draws it. */
      --navi-separator-color-default: #d1d9e0;
      --navi-color-white: white;
      --navi-color-dark: rgb(55, 60, 69);

      --navi-info-color-light: #eaf6fc;
      --navi-info-color: #376cc2;
      --navi-success-color-light: #ecf9ef;
      --navi-success-color: #50c464;
      --navi-warning-color-light: #fdf6e3;
      --navi-warning-color: #f19c05;
      --navi-error-color-light: #fcebed;
      --navi-error-color: #eb364b;

      --navi-xxs: 0.125em; /* = 2px at 16px base */
      --navi-xs: 0.25em; /* = 4px at 16px base */
      --navi-s: 0.5em; /* = 8px at 16px base */
      --navi-m: 1em; /* = 16px at 16px base (base font size) */
      --navi-l: 1.5em; /* = 24px at 16px base */
      --navi-xl: 2em; /* = 32px at 16px base */
      --navi-xxl: 3em; /* 48px at 16px base */

      --navi-typo-xxs: 0.625rem; /* 10px at 16px base */
      --navi-typo-xs: 0.75rem; /* 12px at 16px base */
      --navi-typo-s: 0.875rem; /* 14px at 16px base */
      --navi-typo-m: 1rem; /* 16px at 16px base (base font size) */
      --navi-typo-l: 1.125rem; /* 18px at 16px base */
      --navi-typo-xl: 1.25rem; /* 20px at 16px base */
      --navi-typo-xxl: 1.5rem; /* 24px at 16px base */

      /* Color keywords.
           primary:   the ink of the paper, at full strength. An absolute
                      rather than currentColor: it is what brings a run back
                      to plain text inside a muted one (a value in a secondary
                      label). Themed through --navi-surface-text-color.
           secondary: supporting text, captions, less important labels
           emphasis:  reinforce meaning, make content stand out more
           discrete:  unobtrusive elements that shouldn't compete for attention
           hint:      barely-there color, watermarks, ghost placeholders
         The last four mix currentColor toward transparent or black, so they
         follow whatever ink a container writes in: a dark card sets color and
         nothing else. Theme tokens, like everything on :root — a container
         that overrides one for ITS paper is heard by every popup opened from
         it too, a popup having no way to tell a theme from a paper. */
      --navi-color-primary: var(--navi-surface-text-color);
      --navi-color-secondary: color-mix(in srgb, currentColor 80%, transparent);
      --navi-color-emphasis: color-mix(in srgb, currentColor 50%, black);
      --navi-color-discrete: color-mix(in srgb, currentColor 60%, transparent);
      --navi-color-hint: color-mix(in srgb, currentColor 25%, transparent);
    }

    /* A popup is a new paper (see --navi-popup-color): primary is the ink it
       writes in, not the ink of the container it was opened from. On the
       element itself, so it beats a container's own override whatever the
       layer; an app that wants a popup to keep its container's ink says so on
       the popup, unlayered, and wins in turn. */
    .navi_popover,
    .navi_dialog {
      --navi-color-primary: var(--navi-popup-color);
    }
  }

  ${SAFE_AREA_CSS}

  /* Hidden appearance */
  input[navi-visually-hidden],
  button[navi-visually-hidden],
  div[navi-visually-hidden] {
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
    /* Important to take full size so that scrollIntoView work as expected */
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    white-space: nowrap;
    border: 0;
    clip-path: inset(50%);
    appearance: none;
    overflow: hidden;

    &[navi-debug] {
      position: static;
      width: auto;
      height: auto;
      margin: 0;
      clip-path: none;
      appearance: auto;
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
