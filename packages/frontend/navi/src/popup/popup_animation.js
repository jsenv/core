/**
 * Entry/exit animation CSS shared by Popover and Dialog.
 *
 * Relies on `@starting-style` + `transition-behavior: allow-discrete` so the
 * browser keeps the popover/dialog rendered (not `display: none`) for the
 * duration of the exit transition — no JS timing/animationend bookkeeping
 * needed, `showPopover()`/`hidePopover()` (or `showModal()`/`close()`) can
 * stay perfectly synchronous.
 *
 * `openSelector` is the CSS fragment meaning "is currently open/shown":
 * `:popover-open` for Popover, `[open]` for Dialog.
 */

export const ANIMATION_ATTRIBUTE = "data-navi-animation";

const DURATION = "0.18s";
const SLIDE_DISTANCE = "10px";
const SCALE_FROM = 0.92;

export const buildPopupAnimationCss = (selector, openSelector) => {
  const open = `${selector}${openSelector}`;
  const closed = `${selector}:not(${openSelector})`;
  return /* css */ `
    ${selector}[${ANIMATION_ATTRIBUTE}] {
      transition:
        display ${DURATION} allow-discrete,
        overlay ${DURATION} allow-discrete,
        opacity ${DURATION} ease,
        translate ${DURATION} ease,
        scale ${DURATION} ease;
    }

    /* fade */
    ${selector}[${ANIMATION_ATTRIBUTE}="fade"] {
      opacity: 1;
    }
    ${closed}[${ANIMATION_ATTRIBUTE}="fade"] {
      opacity: 0;
    }
    @starting-style {
      ${open}[${ANIMATION_ATTRIBUTE}="fade"] {
        opacity: 0;
      }
    }

    /* scale — grows from transform-origin (anchor center for Popover, set via
       --navi-animation-origin-x/y; defaults to the element's own center) */
    ${selector}[${ANIMATION_ATTRIBUTE}="scale"] {
      opacity: 1;
      scale: 1;
      transform-origin: var(--navi-animation-origin-x, center)
        var(--navi-animation-origin-y, center);
    }
    ${closed}[${ANIMATION_ATTRIBUTE}="scale"] {
      opacity: 0;
      scale: ${SCALE_FROM};
    }
    @starting-style {
      ${open}[${ANIMATION_ATTRIBUTE}="scale"] {
        opacity: 0;
        scale: ${SCALE_FROM};
      }
    }

    /* slide — auto direction from data-position-y-current (set by
       pickPositionRelativeTo): slides down from the top by default, flips to
       sliding up from the bottom when placed "above" the anchor. */
    ${selector}[${ANIMATION_ATTRIBUTE}="slide"] {
      opacity: 1;
      translate: 0 0;
    }
    ${closed}[${ANIMATION_ATTRIBUTE}="slide"] {
      opacity: 0;
      translate: 0 -${SLIDE_DISTANCE};
    }
    ${closed}[${ANIMATION_ATTRIBUTE}="slide"][data-position-y-current="above"],
    ${closed}[${ANIMATION_ATTRIBUTE}="slide"][data-position-y-current="above-overlap"] {
      translate: 0 ${SLIDE_DISTANCE};
    }
    @starting-style {
      ${open}[${ANIMATION_ATTRIBUTE}="slide"] {
        opacity: 0;
        translate: 0 -${SLIDE_DISTANCE};
      }
      ${open}[${ANIMATION_ATTRIBUTE}="slide"][data-position-y-current="above"],
      ${open}[${ANIMATION_ATTRIBUTE}="slide"][data-position-y-current="above-overlap"] {
        translate: 0 ${SLIDE_DISTANCE};
      }
    }

    /* slide — explicit direction, ignores anchor placement entirely */
    ${closed}[${ANIMATION_ATTRIBUTE}="slide-from-top"] {
      opacity: 0;
      translate: 0 -${SLIDE_DISTANCE};
    }
    ${closed}[${ANIMATION_ATTRIBUTE}="slide-from-bottom"] {
      opacity: 0;
      translate: 0 ${SLIDE_DISTANCE};
    }
    ${closed}[${ANIMATION_ATTRIBUTE}="slide-from-left"] {
      opacity: 0;
      translate: -${SLIDE_DISTANCE} 0;
    }
    ${closed}[${ANIMATION_ATTRIBUTE}="slide-from-right"] {
      opacity: 0;
      translate: ${SLIDE_DISTANCE} 0;
    }
    @starting-style {
      ${open}[${ANIMATION_ATTRIBUTE}="slide-from-top"] {
        opacity: 0;
        translate: 0 -${SLIDE_DISTANCE};
      }
      ${open}[${ANIMATION_ATTRIBUTE}="slide-from-bottom"] {
        opacity: 0;
        translate: 0 ${SLIDE_DISTANCE};
      }
      ${open}[${ANIMATION_ATTRIBUTE}="slide-from-left"] {
        opacity: 0;
        translate: -${SLIDE_DISTANCE} 0;
      }
      ${open}[${ANIMATION_ATTRIBUTE}="slide-from-right"] {
        opacity: 0;
        translate: ${SLIDE_DISTANCE} 0;
      }
    }
  `;
};
