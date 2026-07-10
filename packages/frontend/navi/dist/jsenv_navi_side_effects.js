import { signal, computed, effect } from "@preact/signals";
import { subscribeWindowResizeSettled, subscribeVisualViewportResizeSettled } from "@jsenv/dom";

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

      --navi-focus-outline-width: 2px;
      --navi-focus-outline-color: light-dark(#4476ff, #3b82f6);
      --navi-loader-color: light-dark(#355fcc, #3b82f6);
      --navi-control-tap-highlight-color: transparent;

      --navi-control-font-family: ${controlDefaultFontFamily};
      --navi-control-font-size: ${controlDefaultFontSize};
      --navi-control-border-radius: 2px;
      --navi-control-border-width: 1px;
      --navi-control-border-color: light-dark(#767676, #8e8e93);
      --navi-control-padding-x-default: 2px;
      --navi-control-padding-y-default: 1px;
      /* Global padding defaults — override these to change all button paddings. */
      /* Use --button-padding, --button-padding-x, --button-padding-y for per-button overrides. */
      --navi-button-padding-x-default: 6px;
      --navi-button-padding-y-default: 1px;
      /* For list item we need slightly more padding to be able to see radio/checkbox outline */
      --navi-list-item-padding-x-default: 4px;
      --navi-list-item-padding-y-default: 1px;
      /* default */
      --navi-picker-padding-x-default: var(--navi-control-padding-x-default);
      --navi-picker-padding-y-default: var(--navi-control-padding-y-default);

      --navi-popup-z-index: 1000;
      --navi-popup-border-radius: 8px;
      --navi-popup-border-color: light-dark(#d0d0d0, #3b3b3b);
      --navi-popup-box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.08), 0 12px 40px rgba(0, 0, 0, 0.22);
      --navi-popup-background-color: light-dark(#ffffff, #1c1c1e);
      --navi-backdrop-close-background: rgba(0, 0, 0, 0.08);
      /* "capture" means the rest of the page is fully non-interactive —
         blurred, not just dimmed, so it reads as clearly secondary and
         pulls visual focus onto the popover's own content. */
      --navi-backdrop-capture-background: rgb(255 255 255 / 0.08);
      --navi-backdrop-capture-backdrop-filter: blur(30px) saturate(180%);

      --navi-selection-border-color: #0078d4;
      --navi-selection-background-color: #eaf1fd;
      /* Accent color — used for call-to-action buttons and selected list items.
         Override this single variable to apply a consistent brand color across
         all components that need to stand out. */
      --navi-accent-color: rgb(3, 30, 60);
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

      /* Color keywords — mix currentColor toward transparent or black.
         secondary: supporting text, captions, less important labels
         emphasis:  reinforce meaning, make content stand out more
         discrete:  unobtrusive elements that shouldn't compete for attention
         hint:      barely-there color, watermarks, ghost placeholders */
      --navi-color-secondary: color-mix(in srgb, currentColor 80%, transparent);
      --navi-color-emphasis: color-mix(in srgb, currentColor 50%, black);
      --navi-color-discrete: color-mix(in srgb, currentColor 60%, transparent);
      --navi-color-hint: color-mix(in srgb, currentColor 25%, transparent);
    }
  }

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

export { installImportMetaCssBuild, windowWidthSignal };
//# sourceMappingURL=jsenv_navi_side_effects.js.map
