/**
 * The room a fixed bar takes from the content, published so whatever scrolls
 * under it can give that room back.
 *
 * There are TWO rooms to give back, and forgetting the second one is the
 * classic bug:
 *
 * - **padding**, so the end of the content can be scrolled out from under the
 *   bar. Without it the last screenful stays covered, unreachable.
 * - **scroll-padding**, so anything the browser scrolls TO lands in front of
 *   the bar rather than under it. An anchor link, `scrollIntoView()`, a focused
 *   field brought into view, restoring a scroll position — all of them align
 *   the target with the edge of the scrollport, which is behind the bar. The
 *   padding above does not help here: it moves the content, not the place the
 *   browser scrolls the target to.
 *
 * Published on <html> as CSS variables rather than applied to some element:
 * which element scrolls is the app's business, and an app with more than one
 * would have to fight a component that picked for it. The app either marks its
 * scrolling area with `data-navi-fixed-bar-space` (the rules below) or reads
 * the variables itself. `:root` gets the scroll-padding unconditionally,
 * because the document is the scrollport in the common case and an anchor
 * landing under a bar is never what anyone wants.
 *
 * The variables hold live CSS expressions, not measured numbers — see the
 * comment where FixedBar sets them.
 */

export const FIXED_BAR_SPACE_CSS = /* css */ `
  :root {
    --navi-fixed-bar-space-top: 0px;
    --navi-fixed-bar-space-bottom: 0px;
    --navi-fixed-bar-space-left: 0px;
    --navi-fixed-bar-space-right: 0px;

    scroll-padding-top: var(--navi-fixed-bar-space-top);
    scroll-padding-right: var(--navi-fixed-bar-space-right);
    scroll-padding-bottom: var(--navi-fixed-bar-space-bottom);
    scroll-padding-left: var(--navi-fixed-bar-space-left);
  }

  /* Put this on whatever scrolls under the bars. */
  [data-navi-fixed-bar-space] {
    padding-top: var(--navi-fixed-bar-space-top);
    padding-right: var(--navi-fixed-bar-space-right);
    padding-bottom: var(--navi-fixed-bar-space-bottom);
    padding-left: var(--navi-fixed-bar-space-left);

    scroll-padding-top: var(--navi-fixed-bar-space-top);
    scroll-padding-right: var(--navi-fixed-bar-space-right);
    scroll-padding-bottom: var(--navi-fixed-bar-space-bottom);
    scroll-padding-left: var(--navi-fixed-bar-space-left);
  }
`;

export const setFixedBarSpace = (area, value) => {
  const property = `--navi-fixed-bar-space-${area}`;
  document.documentElement.style.setProperty(property, value);
  return () => {
    document.documentElement.style.removeProperty(property);
  };
};
