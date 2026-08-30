/**
 * Regroup CSS vars that makes sense to share across all navi components.
 */
import { effect } from "@preact/signals";

import {
  visualViewportHeightSignal,
  visualViewportWidthSignal,
} from "./layout/responsive.js";
import { SAFE_AREA_CSS } from "./layout/safe_area.js";
// Side-effect import: turns the on-screen keyboard into something that
// overlays the app instead of resizing the viewport, which is navi's default
// (see that module for why, and safe_area.js's own
// --navi-keyboard-inset-bottom for what then reads the geometry). Here rather
// than in each component: it is one decision about the whole window, and this
// is the module that already makes those.
import "./layout/virtual_keyboard.js";

const button = document.createElement("button");
button.style.display = "none";
document.body.appendChild(button);
const computedStyle = getComputedStyle(button);
const controlDefaultFontFamily = computedStyle.fontFamily;
const controlDefaultFontSize = computedStyle.fontSize;
document.body.removeChild(button);

// The color keywords derived from the ink. Written once and declared on every
// paper — :root, and each surface that is a new one (popup, callout) — so what
// a container pinned for its own paper does not reach the surface. The -mix
// ratios (see :root) are read where this is declared.
const INK_DERIVED_COLOR_TOKENS_CSS = `
  --navi-color-secondary: color-mix(
    in srgb,
    currentColor var(--navi-color-secondary-mix),
    transparent
  );
  --navi-color-emphasis: color-mix(
    in srgb,
    currentColor var(--navi-color-emphasis-mix),
    black
  );
  --navi-color-discrete: color-mix(
    in srgb,
    currentColor var(--navi-color-discrete-mix),
    transparent
  );
  --navi-color-hint: color-mix(
    in srgb,
    currentColor var(--navi-color-hint-mix),
    transparent
  );
`;

const css = /* css */ `
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
      /* The grey rectangle a mobile browser flashes under a finger: we draw
         what a press does ourselves (background, ring, chevron), and the
         browser's rectangle is a square painted over rounded corners.
         Declared here alone because the property is inherited: :root covers
         every element, in and out of navi, so nothing has to remember it.
         Set the token to a color to get the flash back, on the whole app or
         on one subtree. */
      -webkit-tap-highlight-color: var(--navi-tap-highlight-color);
      --navi-tap-highlight-color: transparent;

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

      /* What a callout says about its message, as a color — and what draws
         as one outside the callout too (the icon a picker in callout mode
         presses, see CalloutStatusIcon). */
      --navi-callout-success-color: #4caf50;
      --navi-callout-info-color: #2196f3;
      --navi-callout-warning-color: #ff9800;
      --navi-callout-error-color: #f44336;
      /* No status: the message is an aside, said without an icon and framed
         like a control rather than like a warning. */
      --navi-callout-neutral-color: var(--navi-control-border-color);
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

      /* The line every text is written on, controls included. A number
         rather than "normal", because of the emoji: its box is taller than a
         letter's, so under "normal" the one line carrying one stands taller
         than the lines around it, and under a tighter line its top is cut.
         1.25 is where neither happens — 1 clips the glyph, 1.5 spaces the rows
         out more than reading them asks for — which also makes it the floor
         for an app that displays what people typed.
         The document is written on it; the components that come with a line of
         their own from the browser (Button, Input, Textarea, Select) are handed
         it by name. One number everywhere is what keeps a value on the same
         line whether it is typed in a field or drawn in the page.
         See docs/typography.md. */
      --navi-line-height: 1.25;
      line-height: var(--navi-line-height);
      /* The same line for a control, snapped to the pixel. The browser lays a
         line out at its exact height but paints the glyph on a pixel row: at
         the default control size (13.333px) the line is 16.666px, and the
         two-thirds that do not fit go entirely under the glyph, which then
         sits a pixel above the middle of its field. A whole number of pixels
         has no remainder to put anywhere. Written with em so it resolves on
         the control that uses it, at that control's own size. */
      --navi-control-line-height: round(
        calc(var(--navi-line-height) * 1em),
        1px
      );

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
         nothing else. The share of ink in each is the theme's knob, a -mix
         token read wherever the formulas are declared — here and on each
         surface that re-declares them (rules below) — so a ratio set on :root
         reaches the page and its popups alike. Set on a container it reaches
         none of that container's own text, a var() resolving where its custom
         property is declared; a container that wants one keyword otherwise
         for ITS paper (a white at 88% where 80% of white reads too faint on a
         colored resin) pins the keyword itself, and that value stops at the
         next surface. */
      --navi-color-secondary-mix: 80%;
      --navi-color-emphasis-mix: 50%;
      --navi-color-discrete-mix: 60%;
      --navi-color-hint-mix: 25%;
      --navi-color-primary: var(--navi-surface-text-color);
      ${INK_DERIVED_COLOR_TOKENS_CSS}

      /* What a control shows while it holds nothing: the ::placeholder of an
         input, the empty value slot of a picker. One place for the whole app:

           :root {
             --navi-placeholder-color: #8a94a6;
             --navi-placeholder-font-style: italic;
           }
      */
      --navi-placeholder-color: var(--navi-color-discrete);
      --navi-placeholder-font-style: normal;
    }

    /* A surface is a new paper: its color keywords are computed against the
       ink it writes in, not the container's — the :root formulas again,
       re-declared so a container's own value for one of them stops here. On
       the element itself, so it beats that value whatever the layer; an app
       that wants a surface to keep its container's ink says so on the
       surface, unlayered, and wins in turn.
       A popup writes in --navi-popup-color. */
    .navi_popover,
    .navi_dialog {
      --navi-color-primary: var(--navi-popup-color);
      ${INK_DERIVED_COLOR_TOKENS_CSS}
    }
    /* A callout writes in the UA's own ink: callout.js sets color: revert on
       a [popover] element, which the UA styles CanvasText. */
    .navi_callout {
      --navi-color-primary: CanvasText;
      ${INK_DERIVED_COLOR_TOKENS_CSS}
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
