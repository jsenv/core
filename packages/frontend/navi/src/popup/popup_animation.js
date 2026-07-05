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
 * without touching this file: `--popup-animation-duration`,
 * `--popup-slide-distance`, `--popup-scale-from`.
 */

export const buildPopupAnimationCss = (selector) => {
  const open = `${selector}[aria-expanded="true"]`;
  const closed = `${selector}[aria-expanded="false"]`;

  return /* css */ `
    @layer navi {
      ${selector} {
        --popup-animation-duration: 0.18s;
        --popup-slide-distance: 10px;
        /* Low enough to read as "growing from a point" rather than a subtle
           zoom — combined with transform-origin, this is what makes the
           scale animation look like it originates from the anchor/pointer. */
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

    /* slide — auto direction from data-position-y-current (set by
       pickPositionRelativeTo): slides down from the top by default, flips to
       sliding up from the bottom when placed "above" the anchor. */
    ${selector}[navi-animation="slide"] {
      opacity: 1;
      translate: 0 0;
    }
    ${closed}[navi-animation="slide"] {
      opacity: 0;
      translate: 0 calc(var(--popup-slide-distance) * -1);
    }
    ${closed}[navi-animation="slide"][data-position-y-current="above"],
    ${closed}[navi-animation="slide"][data-position-y-current="above-overlap"] {
      translate: 0 var(--popup-slide-distance);
    }
    @starting-style {
      ${open}[navi-animation="slide"] {
        opacity: 0;
        translate: 0 calc(var(--popup-slide-distance) * -1);
      }
      ${open}[navi-animation="slide"][data-position-y-current="above"],
      ${open}[navi-animation="slide"][data-position-y-current="above-overlap"] {
        translate: 0 var(--popup-slide-distance);
      }
    }

    /* slide — explicit direction, ignores anchor placement entirely */
    ${closed}[navi-animation="slide-from-top"] {
      opacity: 0;
      translate: 0 calc(var(--popup-slide-distance) * -1);
    }
    ${closed}[navi-animation="slide-from-bottom"] {
      opacity: 0;
      translate: 0 var(--popup-slide-distance);
    }
    ${closed}[navi-animation="slide-from-left"] {
      opacity: 0;
      translate: calc(var(--popup-slide-distance) * -1) 0;
    }
    ${closed}[navi-animation="slide-from-right"] {
      opacity: 0;
      translate: var(--popup-slide-distance) 0;
    }
    @starting-style {
      ${open}[navi-animation="slide-from-top"] {
        opacity: 0;
        translate: 0 calc(var(--popup-slide-distance) * -1);
      }
      ${open}[navi-animation="slide-from-bottom"] {
        opacity: 0;
        translate: 0 var(--popup-slide-distance);
      }
      ${open}[navi-animation="slide-from-left"] {
        opacity: 0;
        translate: calc(var(--popup-slide-distance) * -1) 0;
      }
      ${open}[navi-animation="slide-from-right"] {
        opacity: 0;
        translate: var(--popup-slide-distance) 0;
      }
    }
  `;
};
