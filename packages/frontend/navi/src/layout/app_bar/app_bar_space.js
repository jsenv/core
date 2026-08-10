/**
 * The room an app bar takes from the content, published so the scrolling area
 * can give it back.
 *
 * A bar is `position: fixed` (see the bars themselves for why sticky cannot
 * work), so it covers the content instead of pushing it: without a reserve the
 * end of a long page stays under the bar, unreachable. The reserve and the bar
 * must never disagree, so both are computed from the SAME height variable —
 * the reserve published here is that variable plus the safe-area inset, and
 * nothing else. The bar's hairline is drawn with a box-shadow precisely so it
 * stays out of this arithmetic.
 *
 * Published on <html> as a CSS variable rather than applied to some element:
 * which element scrolls is the app's business, and an app with several of them
 * would have to fight a component that picked one. The app marks its scrolling
 * area with `data-navi-app-bar-space` (see the CSS below) or reads the
 * variables itself.
 *
 * The variable holds a live CSS expression, not a measured number: an app
 * overriding the height variable moves the bar and the reserve together, with
 * nothing to recompute.
 */

export const APP_BAR_SPACE_CSS = /* css */ `
  :root {
    --navi-top-bar-space: 0px;
    --navi-bottom-nav-bar-space: 0px;
  }

  /* Put this on whatever scrolls under the bars. */
  [data-navi-app-bar-space] {
    padding-top: var(--navi-top-bar-space);
    padding-bottom: var(--navi-bottom-nav-bar-space);
  }
`;

export const setAppBarSpace = (name, value) => {
  const property = `--navi-${name}-space`;
  document.documentElement.style.setProperty(property, value);
  return () => {
    document.documentElement.style.removeProperty(property);
  };
};
