/**
 * Tracks how far `window.visualViewport`'s own edges sit inset from the
 * layout viewport's edges (`window.innerWidth`/`innerHeight`) — nonzero
 * whenever something shrinks the *visually* available area without
 * resizing the layout viewport itself (the common case: a mobile on-screen
 * keyboard shrinking the bottom; in principle any of the 4 edges could move
 * — a side panel, a foldable device, etc. — so all 4 are tracked, not just
 * the vertical pair).
 *
 * Exposed as 4 CSS custom properties on `document.documentElement` — a
 * genuinely document-wide, not per-instance, concern (the visual viewport
 * is one thing, shared by everything on the page) — so any consumer's own
 * CSS can reference `var(--navi-visual-viewport-inset-top, 0px)` etc.
 * directly, with zero per-instance JS needed on their own end: `position:
 * fixed` + `inset: var(...)` (all 4 sides) + `margin: auto` for centering,
 * or a single non-auto side for a docked/flush edge, both stay correct as
 * the visual viewport moves, automatically, no opt-in prop required.
 *
 * `ensureVisualViewportInsetsTracked()` is idempotent and safe to call from
 * every consumer's own mount/open — the underlying listener is only ever
 * registered once for the whole page, regardless of how many callers ask
 * for it (e.g. several dialogs open at once).
 */

let started = false;

export const ensureVisualViewportInsetsTracked = () => {
  if (started) {
    return;
  }
  if (!window.visualViewport) {
    return;
  }
  started = true;

  const root = document.documentElement;
  const update = () => {
    const vv = window.visualViewport;
    const insetLeft = vv.offsetLeft;
    const insetTop = vv.offsetTop;
    const insetRight = window.innerWidth - (vv.offsetLeft + vv.width);
    const insetBottom = window.innerHeight - (vv.offsetTop + vv.height);
    root.style.setProperty(
      "--navi-visual-viewport-inset-left",
      `${insetLeft}px`,
    );
    root.style.setProperty("--navi-visual-viewport-inset-top", `${insetTop}px`);
    root.style.setProperty(
      "--navi-visual-viewport-inset-right",
      `${insetRight}px`,
    );
    root.style.setProperty(
      "--navi-visual-viewport-inset-bottom",
      `${insetBottom}px`,
    );
  };
  update();

  let resizeTimeout;
  const onResize = () => {
    // On mobile, tapping from one input to another triggers a resize
    // because the virtual keyboard briefly starts to close before the new
    // input receives focus and the keyboard reopens. Debouncing prevents
    // updating during that transient state, which would cause a visible
    // flicker in anything positioned off these vars.
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(update, 100);
  };
  const onScroll = () => {
    update();
  };
  window.visualViewport.addEventListener("resize", onResize);
  window.visualViewport.addEventListener("scroll", onScroll);
};
