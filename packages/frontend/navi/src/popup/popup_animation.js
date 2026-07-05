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
 * Two `animation` kinds:
 * - "clip": reveals via `clip-path` rather than a `scale` transform, so child
 *   content never visually shrinks/distorts and the box's real layout size
 *   is never touched — only what's painted changes. Two modes, chosen by
 *   `data-clip-axis`:
 *   - default (no `data-clip-axis`, set when Popover has a real anchor
 *     element): clips vertically only, revealing out of the anchor's edge —
 *     top when placed below it, bottom when placed above it
 *     (data-position-y-current, set by pickPositionRelativeTo). *Reads* like
 *     the popup's height is growing without any translation happening.
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
  const open = `${selector}[aria-expanded="true"]`;
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
      transition-property: display, overlay, opacity, translate, clip-path;
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
    @starting-style {
      ${open}[navi-fade-animation] {
        opacity: 0;
      }
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
    ${closed}[navi-animation="clip"][data-position-y-current="above-overlap"] {
      clip-path: inset(100% 0 0 0 round var(--popup-border-radius, 0));
    }
    @starting-style {
      ${open}[navi-animation="clip"] {
        clip-path: inset(0 0 100% 0 round var(--popup-border-radius, 0));
      }
      ${open}[navi-animation="clip"][data-position-y-current="above"],
      ${open}[navi-animation="clip"][data-position-y-current="above-overlap"] {
        clip-path: inset(100% 0 0 0 round var(--popup-border-radius, 0));
      }
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
    @starting-style {
      ${open}[navi-animation="clip"][data-clip-axis="xy"] {
        clip-path: inset(50% 50% 50% 50% round var(--popup-border-radius, 0));
        translate: var(--popup-animation-origin-x, 0px)
          var(--popup-animation-origin-y, 0px);
      }
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
    @starting-style {
      ${open}[navi-animation="slide"],
      ${open}[navi-animation="slide-from-top"],
      ${open}[navi-animation="slide-from-bottom"],
      ${open}[navi-animation="slide-from-left"],
      ${open}[navi-animation="slide-from-right"] {
        translate: calc(var(--popup-slide-x, 0) * var(--popup-slide-distance))
          calc(var(--popup-slide-y, -1) * var(--popup-slide-distance));
      }
    }
  `;
};
