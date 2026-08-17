/**
 * Regroup CSS vars that makes sense to share across all navi components.
 */
import { effect } from "@preact/signals";

import {
  visualViewportHeightSignal,
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
      --navi-backdrop-close-background: rgba(0, 0, 0, 0.08);
      /* "capture" means the rest of the page is fully non-interactive —
         blurred, not just dimmed, so it reads as clearly secondary and
         pulls visual focus onto the popover's own content. */
      --navi-backdrop-capture-background: rgb(255 255 255 / 0.08);
      --navi-backdrop-capture-backdrop-filter: blur(30px) saturate(180%);

      /* The popup an action's "confirm" asks its question in. Its own tokens
         rather than the popup ones above: every confirmation in an app is
         re-shaped together here, without touching the pickers and panels that
         are also popups. */
      --navi-confirm-popup-padding: var(--navi-m);
      --navi-confirm-popup-spacing: var(--navi-m);
      --navi-confirm-popup-action-spacing: var(--navi-s);
      --navi-confirm-popup-min-width: 180px;
      --navi-confirm-popup-max-width: 320px;

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
