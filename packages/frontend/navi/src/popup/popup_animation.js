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
 * (e.g. which edge the "clip" animation reveals from) once it's actually
 * rendered, which is later than the point at which `@starting-style` would
 * already have locked in its snapshot. Instead, the opener commits the
 * correctly-measured "closed" frame (transitions suppressed) before flipping
 * `aria-expanded` to `"true"` — an ordinary, already-rendered state change
 * that transitions normally, no special "just born" handling needed.
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
 * `--popup-border-radius` rounds the `clip-path: inset(... round <radius>)`
 * shapes used by "clip" (see below) to match the popup's own border-radius —
 * set it instead of `border-radius` directly on your popup so the two never
 * drift out of sync (Popover's own base CSS reads it back for its actual
 * `border-radius`, see popover.jsx).
 *
 * Fading is a separate, independent concern from `animation` — see
 * `[navi-fade-animation]` below, driven by the `fadeAnimation` prop. It
 * combines with any `animation` kind (or with none at all, for a plain fade).
 *
 * Whenever either `animation` or `fadeAnimation` is active, `box-shadow` is
 * also transitioned to/from `none` (open/closed, and its own
 * `@starting-style`) — the consumer's own box-shadow (e.g. Popover's
 * `demo_popover_box` class) only takes effect once fully open, so the shadow
 * fades in/out along with the rest instead of looking flat while the popup is
 * still moving/clipping.
 *
 * Two `animation` kinds:
 * - "clip": reveals via `clip-path` rather than a `scale` transform, so child
 *   content never visually shrinks/distorts and the box's real layout size
 *   is never touched — only what's painted changes. Three modes, chosen by
 *   `data-clip-axis`:
 *   - default (no `data-clip-axis`, set when Popover has a real anchor and a
 *     non-center Y placement): clips vertically only, revealing out of the
 *     anchor's edge — top when placed below it, bottom when placed above it
 *     (data-position-y-current, set by pickPositionRelativeTo). *Reads* like
 *     the popup's height is growing without any translation happening.
 *   - `data-clip-axis="x"` (real anchor, Y centered — pure "on-the-left"/
 *     "on-the-right" placement): same idea on the horizontal axis, out of
 *     the anchor's left/right edge (data-position-x-current).
 *   - `data-clip-axis="xy"` (no real anchor — an anchor point like "center",
 *     or no anchor at all): clips both axes around a point, combined with a
 *     `translate` from that point to the final resting position
 *     (--popup-animation-origin-x/y — the click/pointer position when
 *     available, else the box's own center, in which case the translate is
 *     a no-op and it just grows in place).
 * - "slide"/"slide-from-*": a real translate-based entrance, sized to the
 *   element's own dimensions (--popup-slide-distance defaults to 100%, i.e.
 *   it travels its own width/height) so it looks like it enters from just
 *   past its final position. Direction comes from `data-anchor` (set
 *   when Popover's `anchor` prop is an anchor point value like "right" or
 *   "top-left") or from the explicit slide-from-top/bottom/left/right variant.
 */

export const buildPopupAnimationCss = (selector) => {
  const closed = `${selector}[aria-expanded="false"]`;

  return /* css */ `
    @layer navi {
      ${selector} {
        --popup-animation-duration: 0.18s;
        --popup-slide-distance: 100%;
        --popup-border-radius: 0;
      }
    }

    ${selector}[navi-animation],
    ${selector}[navi-fade-animation] {
      transition-property:
        display, overlay, opacity, translate, clip-path, box-shadow;
      transition-duration: var(--popup-animation-duration);
      transition-timing-function: ease;
      transition-behavior: allow-discrete;
    }

    /* fade — independent of "animation", combines with any kind (or none,
       for a plain fade in/out). */
    ${selector}[navi-fade-animation] {
      opacity: 1;
    }
    ${closed}[navi-fade-animation] {
      opacity: 0;
    }

    /* box-shadow fades in/out alongside any animation kind, instead of
       staying flat while the popup is still moving/clipping. */
    ${closed}[navi-animation],
    ${closed}[navi-fade-animation] {
      box-shadow: none;
    }

    /* clip — vertical-only by default (anchored case): reveals out of the
       anchor's edge, top when placed below it, bottom when placed above it. */
    ${selector}[navi-animation="clip"] {
      clip-path: inset(0 0 0 0 round var(--popup-border-radius, 0));
      translate: 0 0;
    }
    ${closed}[navi-animation="clip"] {
      clip-path: inset(0 0 100% 0 round var(--popup-border-radius, 0));
    }
    ${closed}[navi-animation="clip"][data-position-y-current="above"],
    ${closed}[navi-animation="clip"][data-position-y-current="aligned-bottom"] {
      clip-path: inset(100% 0 0 0 round var(--popup-border-radius, 0));
    }

    /* clip — horizontal-only (data-clip-axis="x", set when placed purely
       "on-the-left"/"on-the-right" of a real anchor, Y centered): reveals
       out of the anchor's edge, left when placed to its right, right when
       placed to its left. */
    ${selector}[navi-animation="clip"][data-clip-axis="x"] {
      clip-path: inset(0 0 0 0 round var(--popup-border-radius, 0));
      translate: 0 0;
    }
    ${closed}[navi-animation="clip"][data-clip-axis="x"] {
      clip-path: inset(0 100% 0 0 round var(--popup-border-radius, 0));
    }
    ${closed}[navi-animation="clip"][data-clip-axis="x"][data-position-x-current="on-the-left"],
    ${closed}[navi-animation="clip"][data-clip-axis="x"][data-position-x-current="aligned-right"] {
      clip-path: inset(0 0 0 100% round var(--popup-border-radius, 0));
    }

    /* clip — both axes (no real anchor): a point-sized rect (the box's own
       center, in local percentages — no JS measurement needed) growing to
       fill the box, translated from --popup-animation-origin-x/y (the
       click/pointer position, expressed as an offset from the box's own
       center) back to 0 0, so the whole thing glides from the click point to
       its final resting position while it grows. */
    ${selector}[navi-animation="clip"][data-clip-axis="xy"] {
      clip-path: inset(0 0 0 0 round var(--popup-border-radius, 0));
    }
    ${closed}[navi-animation="clip"][data-clip-axis="xy"] {
      clip-path: inset(50% 50% 50% 50% round var(--popup-border-radius, 0));
      translate: var(--popup-animation-origin-x, 0px)
        var(--popup-animation-origin-y, 0px);
    }

    /* slide — direction multipliers. data-anchor (set when Popover's
       anchor prop is an anchor point value, e.g. "right", "top-left") drives
       it automatically; slide-from-top/bottom/left/right set it directly,
       ignoring anchor/position entirely. Falls back to "from the top" when
       neither is present. */
    ${selector}[data-anchor="top"] {
      --popup-slide-x: 0;
      --popup-slide-y: -1;
    }
    ${selector}[data-anchor="top-right"] {
      --popup-slide-x: 1;
      --popup-slide-y: -1;
    }
    ${selector}[data-anchor="right"] {
      --popup-slide-x: 1;
      --popup-slide-y: 0;
    }
    ${selector}[data-anchor="bottom-right"] {
      --popup-slide-x: 1;
      --popup-slide-y: 1;
    }
    ${selector}[data-anchor="bottom"] {
      --popup-slide-x: 0;
      --popup-slide-y: 1;
    }
    ${selector}[data-anchor="bottom-left"] {
      --popup-slide-x: -1;
      --popup-slide-y: 1;
    }
    ${selector}[data-anchor="left"] {
      --popup-slide-x: -1;
      --popup-slide-y: 0;
    }
    ${selector}[data-anchor="top-left"] {
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
      translate: 0 0;
    }
    ${closed}[navi-animation="slide"],
    ${closed}[navi-animation="slide-from-top"],
    ${closed}[navi-animation="slide-from-bottom"],
    ${closed}[navi-animation="slide-from-left"],
    ${closed}[navi-animation="slide-from-right"] {
      translate: calc(var(--popup-slide-x, 0) * var(--popup-slide-distance))
        calc(var(--popup-slide-y, -1) * var(--popup-slide-distance));
    }
  `;
};
