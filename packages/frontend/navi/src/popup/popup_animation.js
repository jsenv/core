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
 * `--popup-slide-distance`, `--popup-scale-from`, `--popup-border-radius`.
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
 * right variant; `data-anchor-area-y`/`data-anchor-area-x` (the requested
 * anchorArea, set by popover.jsx for both a real anchor and
 * anchorReference/point mode) — "above"/"below" and "on-the-left"/
 * "on-the-right" (no overlap with the anchor) drive a translate on that
 * axis, while "aligned-*"/"center" (overlaps the anchor) zeroes that axis
 * out instead of sliding, since translating something that already overlaps
 * its anchor reads oddly. This baseline uses point/corner mode's own sign
 * convention (a point pinned to the top starts further up, off past its own
 * edge, and slides down into place) since there's no real anchor box to
 * overlap and no auto-flip either — final as-is. A real anchor overrides the
 * sign with `data-position-y/x-current` (set by pickPositionRelativeTo once
 * the actual, possibly auto-flipped, side is known), the *opposite*
 * convention ("above" starts closer to the anchor, which sits below it, and
 * slides up away from it), and a small fixed `--popup-slide-distance` of
 * 20px rather than the 100%-of-own-size default — the point is just to hint
 * at "coming from that direction", not to travel far.
 *
 * `animation="scale"`: a plain `scale` transform, `--popup-scale-from`
 * (default 0.9) to `1`. Picked automatically by `animation="auto"` whenever
 * *both* anchorArea axes overlap the anchor (see above) — there's no
 * sensible direction to slide from in that case, e.g. a dead-centered
 * popover or one placed fully inside/against the anchor on both axes.
 */

export const buildPopupAnimationCss = (selector) => {
  return /* css */ `
    @layer navi {
      ${selector} {
        --popup-animation-duration: 0.18s;
        --popup-slide-distance: 100%;
        --popup-scale-from: 0.9;
        --popup-border-radius: 0;
      }
    }

    ${selector} {
      &[navi-animation],
      &[navi-fade-animation] {
        transition-property:
          display, overlay, opacity, translate, scale, box-shadow;
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

      /* scale — grows from --popup-scale-from (default 0.9) to full size,
         no direction involved. */
      &[navi-animation="scale"] {
        scale: 1;
        &[aria-expanded="false"] {
          scale: var(--popup-scale-from);
        }
      }

      /* slide — direction multipliers from the requested anchorArea (see
         this file's top comment): "above"/"below" and "on-the-left"/
         "on-the-right" drive a translate on their axis, "aligned-*"/
         "center" zero it out instead. This is the baseline for
         anchorReference/point mode (no real anchor box to overlap, so no
         auto-flip either — these signs are final): a point pinned to the
         top starts further up, off past its own edge, and slides down into
         place, the opposite of a real anchor's own convention below (which
         overrides this baseline whenever a real anchor is involved). */
      &[data-anchor-area-y="above"] {
        --popup-slide-y: -1;
      }
      &[data-anchor-area-y="below"] {
        --popup-slide-y: 1;
      }
      &[data-anchor-area-y="aligned-top"],
      &[data-anchor-area-y="center"],
      &[data-anchor-area-y="aligned-bottom"] {
        --popup-slide-y: 0;
      }
      &[data-anchor-area-x="on-the-left"] {
        --popup-slide-x: -1;
      }
      &[data-anchor-area-x="on-the-right"] {
        --popup-slide-x: 1;
      }
      &[data-anchor-area-x="aligned-left"],
      &[data-anchor-area-x="center"],
      &[data-anchor-area-x="aligned-right"] {
        --popup-slide-x: 0;
      }

      /* slide — real anchor only: overrides the sign above with the
         *actual* resolved side (may differ from the requested one via
         pickPositionRelativeTo's auto-flip), and switches to a small fixed
         distance instead of a full box-size one (see this file's top
         comment). */
      &[data-position-y-current="above"] {
        --popup-slide-y: 1;
      }
      &[data-position-y-current="below"] {
        --popup-slide-y: -1;
      }
      &[data-position-y-current="aligned-top"],
      &[data-position-y-current="center"],
      &[data-position-y-current="aligned-bottom"] {
        --popup-slide-y: 0;
      }
      &[data-position-x-current="on-the-left"] {
        --popup-slide-x: 1;
      }
      &[data-position-x-current="on-the-right"] {
        --popup-slide-x: -1;
      }
      &[data-position-x-current="aligned-left"],
      &[data-position-x-current="center"],
      &[data-position-x-current="aligned-right"] {
        --popup-slide-x: 0;
      }
      &[navi-animation="slide"] {
        &[data-position-y-current],
        &[data-position-x-current] {
          --popup-slide-distance: 20px;
        }
      }

      /* slide — explicit direction, ignoring anchor/position entirely. */
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
