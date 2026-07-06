/**
 * Entry/exit animation CSS shared by Popover and Dialog.
 *
 * Relies on `transition-behavior: allow-discrete` so the browser keeps the
 * popover/dialog rendered (not `display: none`) for the duration of the exit
 * transition — no JS timing/animationend bookkeeping needed,
 * `showPopover()`/`hidePopover()` (or `showModal()`/`close()`) can stay
 * perfectly synchronous.
 *
 * Deliberately no `@starting-style`: the "closed" selectors below (keyed on
 * `[aria-expanded="false"]`) are what an entry transition needs to animate
 * *from* — but the popup's opener (popover.jsx) can only measure/position it
 * once it's actually rendered, which is later than the point at which
 * `@starting-style` would already have locked in its snapshot. Instead, the
 * opener commits the correctly-measured "closed" frame (transitions
 * suppressed) before flipping `aria-expanded` to `"true"` — an ordinary,
 * already-rendered state change that transitions normally, no special "just
 * born" handling needed.
 *
 * Both Popover and Dialog set `aria-expanded="true"`/`"false"` on themselves
 * (imperatively, in sync with showPopover()/hidePopover() or
 * showModal()/close()) so this file can key off a single "is currently
 * open/shown" selector without needing to know which one it's styling.
 *
 * Timing/distance are CSS variables (with defaults below) rather than JS
 * constants, so any consumer can override them per-instance from CSS (or via
 * the `animationDuration` prop, wired to --popup-animation-duration through
 * Box's styleCSSVars) without touching this file: `--popup-animation-duration`,
 * `--popup-slide-distance`, `--popup-border-radius`.
 *
 * Fading is a separate, independent concern from `animation` — see
 * `[navi-fade-animation]` below, driven by the `fadeAnimation` prop. It
 * combines with any `animation` kind (or with none at all, for a plain fade).
 *
 * Whenever either `animation` or `fadeAnimation` is active, `box-shadow` is
 * also transitioned to/from `none` (open/closed) — the consumer's own
 * box-shadow (e.g. Popover's `demo_popover_box` class) only takes effect once
 * fully open, so the shadow fades in/out along with the rest instead of
 * looking flat while the popup is still moving.
 *
 * `animation="slide"`/`"slide-from-*"`: a real translate-based entrance.
 * Direction comes from, in order: the explicit slide-from-top/bottom/left/
 * right variant; `data-position-y/x-current` (real anchor — collapses the
 * aligned and bare variants, sliding a small fixed `--popup-slide-distance`
 * of 20px, not a distance relative to the popup's own size — the point is
 * just to hint at "coming from that direction", not to travel far); or
 * `data-anchor` (point/corner mode, set to an anchor point value like
 * "right"/"top-left", sliding the full 100%-of-own-size default instead, so
 * it looks like it enters from just past its final position).
 */

export const buildPopupAnimationCss = (selector) => {
  return /* css */ `
    @layer navi {
      ${selector} {
        --popup-animation-duration: 0.18s;
        --popup-slide-distance: 100%;
        --popup-border-radius: 0;
      }
    }

    ${selector} {
      &[navi-animation],
      &[navi-fade-animation] {
        transition-property: display, overlay, opacity, translate, box-shadow;
        transition-duration: var(--popup-animation-duration);
        transition-timing-function: ease;
        transition-behavior: allow-discrete;
      }

      /* fade — independent of "animation", combines with any kind (or none,
         for a plain fade in/out). */
      &[navi-fade-animation] {
        opacity: 1;
      }
      &[aria-expanded="false"][navi-fade-animation] {
        opacity: 0;
      }

      /* box-shadow fades in/out alongside any animation kind, instead of
         staying flat while the popup is still moving. */
      &[aria-expanded="false"] {
        &[navi-animation],
        &[navi-fade-animation] {
          box-shadow: none;
        }
      }

      /* slide — direction multipliers for a real anchor:
         data-position-y/x-current (set by pickPositionRelativeTo) plays the
         same role data-anchor plays below for point/corner mode, collapsing
         the aligned and bare variants into one of three buckets each. The
         sign is flipped from point/corner mode's own convention below:
         "above" starts closer to the anchor (which sits below it) and slides
         up, away from it, into its final resting position — the opposite of
         a point pinned to the "top" of its reference box, which starts
         further up (off past its edge) and slides down into place. A small
         fixed px distance, not --popup-slide-distance's 100%-of-own-size
         default — sliding a whole box-height away from a real anchor reads
         as excessive; the point is just to hint at "coming from that
         direction". */
      &[data-position-y-current="above"],
      &[data-position-y-current="aligned-top"] {
        --popup-slide-y: 1;
      }
      &[data-position-y-current="below"],
      &[data-position-y-current="aligned-bottom"] {
        --popup-slide-y: -1;
      }
      &[data-position-y-current="center"] {
        --popup-slide-y: 0;
      }
      &[data-position-x-current="on-the-left"],
      &[data-position-x-current="aligned-left"] {
        --popup-slide-x: 1;
      }
      &[data-position-x-current="on-the-right"],
      &[data-position-x-current="aligned-right"] {
        --popup-slide-x: -1;
      }
      &[data-position-x-current="center"] {
        --popup-slide-x: 0;
      }
      &[navi-animation="slide"] {
        &[data-position-y-current],
        &[data-position-x-current] {
          --popup-slide-distance: 20px;
        }
      }

      /* slide — direction multipliers for anchor="viewport"/"offsetParent"
         (point/corner mode): data-anchor (set when Popover's anchor prop is
         an anchor point value, e.g. "right", "top-left") drives it
         automatically; slide-from-top/bottom/left/right set it directly,
         ignoring anchor/position entirely. */
      &[data-anchor="top"] {
        --popup-slide-x: 0;
        --popup-slide-y: -1;
      }
      &[data-anchor="top-right"] {
        --popup-slide-x: 1;
        --popup-slide-y: -1;
      }
      &[data-anchor="right"] {
        --popup-slide-x: 1;
        --popup-slide-y: 0;
      }
      &[data-anchor="bottom-right"] {
        --popup-slide-x: 1;
        --popup-slide-y: 1;
      }
      &[data-anchor="bottom"] {
        --popup-slide-x: 0;
        --popup-slide-y: 1;
      }
      &[data-anchor="bottom-left"] {
        --popup-slide-x: -1;
        --popup-slide-y: 1;
      }
      &[data-anchor="left"] {
        --popup-slide-x: -1;
        --popup-slide-y: 0;
      }
      &[data-anchor="top-left"] {
        --popup-slide-x: -1;
        --popup-slide-y: -1;
      }
      &[navi-animation="slide-from-top"] {
        --popup-slide-x: 0;
        --popup-slide-y: -1;
      }
      &[navi-animation="slide-from-bottom"] {
        --popup-slide-x: 0;
        --popup-slide-y: 1;
      }
      &[navi-animation="slide-from-left"] {
        --popup-slide-x: -1;
        --popup-slide-y: 0;
      }
      &[navi-animation="slide-from-right"] {
        --popup-slide-x: 1;
        --popup-slide-y: 0;
      }

      &[navi-animation="slide"],
      &[navi-animation="slide-from-top"],
      &[navi-animation="slide-from-bottom"],
      &[navi-animation="slide-from-left"],
      &[navi-animation="slide-from-right"] {
        translate: 0 0;

        &[aria-expanded="false"] {
          translate: calc(var(--popup-slide-x, 0) * var(--popup-slide-distance))
            calc(var(--popup-slide-y, -1) * var(--popup-slide-distance));
        }
      }
    }
  `;
};
