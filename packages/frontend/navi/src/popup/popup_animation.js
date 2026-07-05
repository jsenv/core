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
 */

const DURATION = "0.18s";
const SLIDE_DISTANCE = "10px";
const SCALE_FROM = 0.92;

export const buildPopupAnimationCss = (selector) => {
  const open = `${selector}[aria-expanded="true"]`;
  const closed = `${selector}[aria-expanded="false"]`;

  return /* css */ `
    ${selector}[navi-animation] {
      transition:
        display ${DURATION} allow-discrete,
        overlay ${DURATION} allow-discrete,
        opacity ${DURATION} ease,
        translate ${DURATION} ease,
        scale ${DURATION} ease;
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

    /* scale — grows from transform-origin (anchor center for Popover, set via
       --navi-animation-origin-x/y; defaults to the element's own center) */
    ${selector}[navi-animation="scale"] {
      opacity: 1;
      transform-origin: var(--navi-animation-origin-x, center)
        var(--navi-animation-origin-y, center);
      scale: 1;
    }
    ${closed}[navi-animation="scale"] {
      opacity: 0;
      scale: ${SCALE_FROM};
    }
    @starting-style {
      ${open}[navi-animation="scale"] {
        opacity: 0;
        scale: ${SCALE_FROM};
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
      translate: 0 -${SLIDE_DISTANCE};
    }
    ${closed}[navi-animation="slide"][data-position-y-current="above"],
    ${closed}[navi-animation="slide"][data-position-y-current="above-overlap"] {
      translate: 0 ${SLIDE_DISTANCE};
    }
    @starting-style {
      ${open}[navi-animation="slide"] {
        opacity: 0;
        translate: 0 -${SLIDE_DISTANCE};
      }
      ${open}[navi-animation="slide"][data-position-y-current="above"],
      ${open}[navi-animation="slide"][data-position-y-current="above-overlap"] {
        translate: 0 ${SLIDE_DISTANCE};
      }
    }

    /* slide — explicit direction, ignores anchor placement entirely */
    ${closed}[navi-animation="slide-from-top"] {
      opacity: 0;
      translate: 0 -${SLIDE_DISTANCE};
    }
    ${closed}[navi-animation="slide-from-bottom"] {
      opacity: 0;
      translate: 0 ${SLIDE_DISTANCE};
    }
    ${closed}[navi-animation="slide-from-left"] {
      opacity: 0;
      translate: -${SLIDE_DISTANCE} 0;
    }
    ${closed}[navi-animation="slide-from-right"] {
      opacity: 0;
      translate: ${SLIDE_DISTANCE} 0;
    }
    @starting-style {
      ${open}[navi-animation="slide-from-top"] {
        opacity: 0;
        translate: 0 -${SLIDE_DISTANCE};
      }
      ${open}[navi-animation="slide-from-bottom"] {
        opacity: 0;
        translate: 0 ${SLIDE_DISTANCE};
      }
      ${open}[navi-animation="slide-from-left"] {
        opacity: 0;
        translate: -${SLIDE_DISTANCE} 0;
      }
      ${open}[navi-animation="slide-from-right"] {
        opacity: 0;
        translate: ${SLIDE_DISTANCE} 0;
      }
    }
  `;
};
