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
 * `animation="slide-from-*"`: a real translate-based entrance, one of 8
 * directions (top/bottom/left/right and the 4 diagonals). Popover always
 * resolves to one of these concretely in JS (see popover.jsx's
 * `resolveSlideFrom`) — direction and distance both depend on whether
 * there's a real anchor (a small fixed 20px hint, "coming from that
 * direction" without traveling far) or not (anchorReference/point mode,
 * traveling the full 100%-of-own-size default instead) — this file only
 * renders whatever concrete direction it's given, no attribute-cascade
 * resolution logic here. `animation="slide"` alone (no direction) is treated
 * the same as `"slide-from-top"` — a plain fallback for a caller that wants
 * *some* slide without picking a side.
 *
 * `animation="scale"`: a plain `scale` transform, `--popup-scale-from`
 * (default 0.9) to `1`. Popover picks this automatically over "slide" for
 * `animation="auto"` whenever both anchorArea axes overlap the anchor —
 * there's no sensible direction to slide from in that case, e.g. a
 * dead-centered popover or one placed fully inside/against the anchor on
 * both axes.
 *
 * `animation="view-transition"` (Popover only, experimental): none of the
 * CSS below applies — popover.jsx wraps its show/hide in
 * `document.startViewTransition()` instead, which does its own before/after
 * snapshot diffing (and, as a side effect, makes the popover non-interactive
 * for the duration, unlike this file's CSS-transition approach). See
 * popover.jsx's own `css` block for the handful of `::view-transition-*`
 * rules that mode needs — deliberately excluded here since this file is
 * shared with Dialog, which doesn't use it.
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
      &[navi-animation]:not([navi-animation="view-transition"]),
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

      /* slide — direction multipliers, one per concrete navi-animation
         value (see this file's top comment: popover.jsx always resolves to
         one of these, distance/direction already accounting for
         anchor-vs-anchorReference and any auto-flip). */
      &[navi-animation="slide"],
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
      &[navi-animation="slide-from-top-left"] {
        --popup-slide-x: -1;
        --popup-slide-y: -1;
      }
      &[navi-animation="slide-from-top-right"] {
        --popup-slide-x: 1;
        --popup-slide-y: -1;
      }
      &[navi-animation="slide-from-bottom-left"] {
        --popup-slide-x: -1;
        --popup-slide-y: 1;
      }
      &[navi-animation="slide-from-bottom-right"] {
        --popup-slide-x: 1;
        --popup-slide-y: 1;
      }

      &[navi-animation="slide"],
      &[navi-animation="slide-from-top"],
      &[navi-animation="slide-from-bottom"],
      &[navi-animation="slide-from-left"],
      &[navi-animation="slide-from-right"],
      &[navi-animation="slide-from-top-left"],
      &[navi-animation="slide-from-top-right"],
      &[navi-animation="slide-from-bottom-left"],
      &[navi-animation="slide-from-bottom-right"] {
        translate: 0 0;

        &[aria-expanded="false"] {
          translate: calc(var(--popup-slide-x, 0) * var(--popup-slide-distance))
            calc(var(--popup-slide-y, -1) * var(--popup-slide-distance));
        }
      }
    }
  `;
};
