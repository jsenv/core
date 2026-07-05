/**
 * Entry/exit animation CSS shared by Popover and Dialog.
 *
 * Relies on `@starting-style` + `transition-behavior: allow-discrete` so the
 * browser keeps the popover/dialog rendered (not `display: none`) for the
 * duration of the exit transition — no JS timing/animationend bookkeeping
 * needed, `showPopover()`/`hidePopover()` (or `showModal()`/`close()`) can
 * stay perfectly synchronous.
 *
 * Both Popover and Dialog set `aria-expanded="true"`/`"false"` on themselves
 * (imperatively, in sync with showPopover()/hidePopover() or
 * showModal()/close()) so this file can key off a single "is currently
 * open/shown" selector without needing to know which one it's styling.
 *
 * Timing/distance/scale are CSS variables (with defaults below) rather than
 * JS constants, so any consumer can override them per-instance from CSS
 * (or via the `animationDuration` prop, wired to --popup-animation-duration
 * through Box's styleCSSVars) without touching this file:
 * `--popup-animation-duration`, `--popup-slide-distance`, `--popup-scale`.
 *
 * Four animation kinds:
 * - "fade": opacity only.
 * - "scale": uniform grow from a point (--popup-animation-origin-x/y — the
 *   anchor's center when anchored, the click/pointer position otherwise).
 * - "grow": grows only vertically out of the anchor's edge (transform-origin
 *   "top"/"bottom" from data-position-y-current) — this is what a popover
 *   anchored to a trigger element should use: it *reads* like a slide-down
 *   without anything visually translating, which looks more natural for
 *   dropdown-like content than an actual translation would.
 * - "slide"/"slide-from-*": a real translate-based entrance, sized to the
 *   element's own dimensions (--popup-slide-distance defaults to 100%, i.e.
 *   it travels its own width/height) so it looks like it enters from just
 *   past its final position. Direction comes from `data-anchor-side` (set
 *   when Popover's `anchor` prop is a sided/stickTo value like "right" or
 *   "top-left") or from the explicit slide-from-top/bottom/left/right variant.
 */

export const buildPopupAnimationCss = (selector) => {
  const open = `${selector}[aria-expanded="true"]`;
  const closed = `${selector}[aria-expanded="false"]`;

  return /* css */ `
    @layer navi {
      ${selector} {
        --popup-animation-duration: 0.18s;
        --popup-slide-distance: 100%;
        /* Low enough to read as "growing from a point" rather than a subtle
           zoom — combined with transform-origin, this is what makes the
           scale/grow animations look like they originate from the
           anchor/pointer. */
        --popup-scale: 0.1;
      }
    }

    ${selector}[navi-animation] {
      transition-property: display, overlay, opacity, translate, scale;
      transition-duration: var(--popup-animation-duration);
      transition-timing-function: ease;
      transition-behavior: allow-discrete;
    }

    /* fade */
    ${selector}[navi-animation="fade"] {
      opacity: 1;
    }
    ${closed}[navi-animation="fade"] {
      opacity: 0;
    }
    @starting-style {
      ${open}[navi-animation="fade"] {
        opacity: 0;
      }
    }

    /* scale — grows from transform-origin, set via
       --popup-animation-origin-x/y (anchor point when anchored, pointer
       position when not; defaults to the element's own center) */
    ${selector}[navi-animation="scale"] {
      opacity: 1;
      transform-origin: var(--popup-animation-origin-x, center)
        var(--popup-animation-origin-y, center);
      scale: 1;
    }
    ${closed}[navi-animation="scale"] {
      opacity: 0;
      scale: var(--popup-scale);
    }
    @starting-style {
      ${open}[navi-animation="scale"] {
        opacity: 0;
        scale: var(--popup-scale);
      }
    }

    /* grow — vertical-only scale out of the anchor's edge: top when the
       popup is placed below the anchor, bottom when placed above it
       (data-position-y-current, set by pickPositionRelativeTo). No JS
       computation needed, unlike "scale". */
    ${selector}[navi-animation="grow"] {
      opacity: 1;
      transform-origin: center top;
      scale: 1 1;
    }
    ${selector}[navi-animation="grow"][data-position-y-current="above"],
    ${selector}[navi-animation="grow"][data-position-y-current="above-overlap"] {
      transform-origin: center bottom;
    }
    ${closed}[navi-animation="grow"] {
      opacity: 0;
      scale: 1 var(--popup-scale);
    }
    @starting-style {
      ${open}[navi-animation="grow"] {
        opacity: 0;
        scale: 1 var(--popup-scale);
      }
    }

    /* slide — direction multipliers. data-anchor-side (set when Popover's
       anchor prop is a sided value, e.g. "right", "top-left") drives it
       automatically; slide-from-top/bottom/left/right set it directly,
       ignoring anchor/position entirely. Falls back to "from the top" when
       neither is present. */
    ${selector}[data-anchor-side="top"] {
      --popup-slide-x: 0;
      --popup-slide-y: -1;
    }
    ${selector}[data-anchor-side="top-right"] {
      --popup-slide-x: 1;
      --popup-slide-y: -1;
    }
    ${selector}[data-anchor-side="right"] {
      --popup-slide-x: 1;
      --popup-slide-y: 0;
    }
    ${selector}[data-anchor-side="bottom-right"] {
      --popup-slide-x: 1;
      --popup-slide-y: 1;
    }
    ${selector}[data-anchor-side="bottom"] {
      --popup-slide-x: 0;
      --popup-slide-y: 1;
    }
    ${selector}[data-anchor-side="bottom-left"] {
      --popup-slide-x: -1;
      --popup-slide-y: 1;
    }
    ${selector}[data-anchor-side="left"] {
      --popup-slide-x: -1;
      --popup-slide-y: 0;
    }
    ${selector}[data-anchor-side="top-left"] {
      --popup-slide-x: -1;
      --popup-slide-y: -1;
    }
    ${selector}[navi-animation="slide-from-top"] {
      --popup-slide-x: 0;
      --popup-slide-y: -1;
    }
    ${selector}[navi-animation="slide-from-bottom"] {
      --popup-slide-x: 0;
      --popup-slide-y: 1;
    }
    ${selector}[navi-animation="slide-from-left"] {
      --popup-slide-x: -1;
      --popup-slide-y: 0;
    }
    ${selector}[navi-animation="slide-from-right"] {
      --popup-slide-x: 1;
      --popup-slide-y: 0;
    }

    ${selector}[navi-animation="slide"],
    ${selector}[navi-animation="slide-from-top"],
    ${selector}[navi-animation="slide-from-bottom"],
    ${selector}[navi-animation="slide-from-left"],
    ${selector}[navi-animation="slide-from-right"] {
      opacity: 1;
      translate: 0 0;
    }
    ${closed}[navi-animation="slide"],
    ${closed}[navi-animation="slide-from-top"],
    ${closed}[navi-animation="slide-from-bottom"],
    ${closed}[navi-animation="slide-from-left"],
    ${closed}[navi-animation="slide-from-right"] {
      opacity: 0;
      translate: calc(var(--popup-slide-x, 0) * var(--popup-slide-distance))
        calc(var(--popup-slide-y, -1) * var(--popup-slide-distance));
    }
    @starting-style {
      ${open}[navi-animation="slide"],
      ${open}[navi-animation="slide-from-top"],
      ${open}[navi-animation="slide-from-bottom"],
      ${open}[navi-animation="slide-from-left"],
      ${open}[navi-animation="slide-from-right"] {
        opacity: 0;
        translate: calc(var(--popup-slide-x, 0) * var(--popup-slide-distance))
          calc(var(--popup-slide-y, -1) * var(--popup-slide-distance));
      }
    }
  `;
};
