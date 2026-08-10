/**
 * The room a fixed bar takes from the content, published so whatever scrolls
 * under it can give that room back.
 *
 * Published on <html> as a CSS variable rather than applied to some element:
 * which element scrolls is the app's business, and an app with more than one
 * would have to fight a component that picked for it. The app either marks its
 * scrolling area with `data-navi-fixed-bar-space` (the rule below) or reads
 * the variables itself.
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
  }

  /* Put this on whatever scrolls under the bars. */
  [data-navi-fixed-bar-space] {
    padding-top: var(--navi-fixed-bar-space-top);
    padding-right: var(--navi-fixed-bar-space-right);
    padding-bottom: var(--navi-fixed-bar-space-bottom);
    padding-left: var(--navi-fixed-bar-space-left);
  }
`;

export const setFixedBarSpace = (area, value) => {
  const property = `--navi-fixed-bar-space-${area}`;
  document.documentElement.style.setProperty(property, value);
  return () => {
    document.documentElement.style.removeProperty(property);
  };
};
