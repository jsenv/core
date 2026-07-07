/**
 * Regroup CSS vars that makes sense to share across all navi components.
 */
import { effect } from "@preact/signals";

import {
  visualViewportHeightSignal,
  visualViewportInsetBottomSignal,
  visualViewportInsetLeftSignal,
  visualViewportInsetRightSignal,
  visualViewportInsetTopSignal,
  visualViewportWidthSignal,
} from "./layout/responsive.js";

const button = document.createElement("button");
button.style.display = "none";
document.body.appendChild(button);
const computedStyle = getComputedStyle(button);
const controlDefaultFontFamily = computedStyle.fontFamily;
const controlDefaultFontSize = computedStyle.fontSize;
document.body.removeChild(button);

const css = /* css */ `
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

      --navi-popup-border-radius: 8px;
      --navi-popup-border-color: light-dark(#d0d0d0, #3b3b3b);
      --navi-popup-box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.08), 0 12px 40px rgba(0, 0, 0, 0.22);

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
import.meta.css = css;

effect(() => {
  document.documentElement.style.setProperty(
    "--navi-vvw",
    `${visualViewportWidthSignal.value}px`,
  );
  document.documentElement.style.setProperty(
    "--navi-vvh",
    `${visualViewportHeightSignal.value}px`,
  );
});

// Generic naming ("visual viewport inset"), but in practice today this is
// almost always the on-screen keyboard on mobile shrinking the bottom one.
// Always active (not gated behind any consumer opting in) since these are
// page-wide facts, same spirit as --navi-vvw/--navi-vvh above — any
// consumer's own CSS can reference these 4 vars directly with zero
// per-instance JS of its own. Also dispatched as a "navi_vv_inset_change"
// event on window (not just written as CSS vars) so a consumer whose own
// positioning depends on these values can react imperatively too — Dialog's
// own via-attribute renderer listens for this to re-dispatch
// "navi_position_change" on itself, which visibleRectEffect (visible_rect.js)
// already listens for on popover/dialog/details ancestors specifically for
// this kind of "something repositioned, recheck" signal (so a Popover
// anchored inside a Dialog stays correctly positioned if the dialog itself
// shifts to stay clear of the keyboard).
effect(() => {
  const top = visualViewportInsetTopSignal.value;
  const right = visualViewportInsetRightSignal.value;
  const bottom = visualViewportInsetBottomSignal.value;
  const left = visualViewportInsetLeftSignal.value;
  document.documentElement.style.setProperty(
    "--navi-visual-viewport-inset-top",
    `${top}px`,
  );
  document.documentElement.style.setProperty(
    "--navi-visual-viewport-inset-right",
    `${right}px`,
  );
  document.documentElement.style.setProperty(
    "--navi-visual-viewport-inset-bottom",
    `${bottom}px`,
  );
  document.documentElement.style.setProperty(
    "--navi-visual-viewport-inset-left",
    `${left}px`,
  );
  window.dispatchEvent(new CustomEvent("navi_vv_inset_change"));
});
