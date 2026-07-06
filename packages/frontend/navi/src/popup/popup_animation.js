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
 * Timing is a CSS variable (with a default below) rather than a JS constant,
 * so any consumer can override it per-instance from CSS (or via the
 * `animationDuration` prop, wired to --popup-animation-duration through
 * Box's styleCSSVars) without touching this file: `--popup-animation-duration`,
 * `--popup-scale-from`, `--popup-border-radius`. `slide-from-*`'s own
 * 100%-of-own-size distance is hardcoded for now rather than exposed as a
 * variable — fine to revisit if a consumer ever needs to override it.
 *
 * Fading is driven by `[navi-fade-animation]` below — a separate attribute
 * from `[navi-animation]` in CSS terms (its own selector, its own opacity
 * rule). Popover sets both attributes together whenever any animation is
 * active, one combined switch with no separate `fadeAnimation` prop (see
 * popover.jsx's own top comment). Dialog sets `navi-fade-animation`
 * independently via its own `fadeAnimation` prop, unrelated to any
 * `animation` kind.
 *
 * Whenever either attribute is active, `box-shadow` is also transitioned
 * to/from `none` (open/closed) — the consumer's own box-shadow (e.g.
 * Popover's `demo_popover_box` class) only takes effect once fully open, so
 * the shadow fades in/out along with the rest instead of looking flat while
 * the popup is still moving.
 *
 * `animation="fading"` (Popover): opacity only, no motion — its own
 * self-contained `[navi-animation="fading"]` rule below, independent of
 * `[navi-fade-animation]` (Popover happens to set both together, but this
 * kind doesn't rely on that).
 *
 * `animation="slide-from-*"` (anchorReference/point mode only): a real
 * translate-based entrance, 8 directions (cardinal + 4 diagonals), each
 * 100%-of-own-size. Popover always resolves `animation="auto"`/`"sliding"`
 * to one of these concretely in JS (see popover.jsx's
 * `resolveDirectionValue`), so there's no bare `animation="sliding"`
 * selector here at all — a point/corner has no anchor edge to grow out of,
 * so it slides in instead. The word names *where it comes from*: placed
 * "above" (a point/corner), it slides in from the top.
 *
 * `animation="expand-*"` (a real anchor only, the auto-picked default
 * there): reads better against a real anchor than a translate, which
 * visually travels *through* the anchor element on its way in. Grows out of
 * the anchor's own edge via `scale` + `transform-origin`, 8 directions
 * (cardinal + 4 diagonals) — cardinal ones scale a single axis only
 * (`expand-up`/`expand-down`: Y only; `expand-left`/`expand-right`: X
 * only), diagonals scale both. The word names the motion/growth direction,
 * the opposite compass point from the point/corner family above: placed
 * "above" the anchor, it grows *up*, away from the anchor (which sits below
 * it) — not "from the top".
 *
 * `animation="scaling"`: a plain `scale` transform, `--popup-scale-from`
 * (default 0.9) to `1`, uniform on both axes, no direction/edge involved.
 * Popover picks this automatically for `animation="auto"` whenever both
 * anchorArea axes overlap the anchor — there's no sensible direction to
 * grow/slide from in that case, e.g. a dead-centered popover or one placed
 * fully inside/against the anchor on both axes. Popover's own
 * `spawnFromPointer` prop (anchorReference/point mode + "scaling" only)
 * points `transform-origin` at the click/pointer position instead of the
 * box's own center — see `--popup-spawn-origin-x/y` below, set by
 * popover.jsx's `positionPopover`.
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

      /* fading — opacity only, no motion. */
      &[navi-animation="fading"] {
        opacity: 1;
        &[aria-expanded="false"] {
          opacity: 0;
        }
      }

      /* scaling — grows from --popup-scale-from (default 0.9) to full size,
         no direction involved. spawnFromPointer (Popover only, see this
         file's top comment) points the growth at the click/pointer position
         instead of the box's own center — a static anchor point for the
         transform, doesn't itself need to transition. */
      &[navi-animation="scaling"] {
        scale: 1;
        &[aria-expanded="false"] {
          scale: var(--popup-scale-from);
        }
        &[data-spawn-from-pointer] {
          transform-origin: var(--popup-spawn-origin-x, 50%)
            var(--popup-spawn-origin-y, 50%);
        }
      }

      /* expand — real-anchor family (see this file's top comment): grows
         out of the anchor's own edge via transform-origin + scale.
         Cardinal directions scale a single axis only; diagonals scale
         both. */
      &[navi-animation="expand-up"] {
        transform-origin: bottom;
        scale: 1 1;
        &[aria-expanded="false"] {
          scale: 1 var(--popup-scale-from);
        }
      }
      &[navi-animation="expand-down"] {
        transform-origin: top;
        scale: 1 1;
        &[aria-expanded="false"] {
          scale: 1 var(--popup-scale-from);
        }
      }
      &[navi-animation="expand-left"] {
        transform-origin: right;
        scale: 1 1;
        &[aria-expanded="false"] {
          scale: var(--popup-scale-from) 1;
        }
      }
      &[navi-animation="expand-right"] {
        transform-origin: left;
        scale: 1 1;
        &[aria-expanded="false"] {
          scale: var(--popup-scale-from) 1;
        }
      }
      &[navi-animation="expand-up-left"] {
        transform-origin: bottom right;
        scale: 1 1;
        &[aria-expanded="false"] {
          scale: var(--popup-scale-from);
        }
      }
      &[navi-animation="expand-up-right"] {
        transform-origin: bottom left;
        scale: 1 1;
        &[aria-expanded="false"] {
          scale: var(--popup-scale-from);
        }
      }
      &[navi-animation="expand-down-left"] {
        transform-origin: top right;
        scale: 1 1;
        &[aria-expanded="false"] {
          scale: var(--popup-scale-from);
        }
      }
      &[navi-animation="expand-down-right"] {
        transform-origin: top left;
        scale: 1 1;
        &[aria-expanded="false"] {
          scale: var(--popup-scale-from);
        }
      }

      /* slide — anchorReference/point mode family: direction multipliers,
         one per concrete navi-animation value, 100%-of-own-size distance
         (see this file's top comment). */
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
          translate: calc(var(--popup-slide-x, 0) * 100%)
            calc(var(--popup-slide-y, -1) * 100%);
        }
      }
    }
  `;
};
