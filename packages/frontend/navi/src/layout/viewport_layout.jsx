import { Box } from "../box/box.jsx";

const css = /* css */ `
  @layer navi {
    .navi_viewport_layout {
      --layout-padding: 40px;
      --layout-background: white;
    }
  }

  .navi_viewport_layout {
    padding-top: var(
      --layout-padding-top,
      var(--layout-padding-y, var(--layout-padding))
    );
    padding-right: var(
      --layout-padding-right,
      var(--layout-padding-x, var(--layout-padding))
    );
    padding-bottom: var(
      --layout-padding-bottom,
      var(--layout-padding-y, var(--layout-padding))
    );
    padding-left: var(
      --layout-padding-left,
      var(--layout-padding-x, var(--layout-padding))
    );
    background: var(--layout-background);
  }
`;

const ViewportLayoutStyleCSSVars = {
  padding: "--layout-padding",
  paddingTop: "--layout-padding-top",
  paddingBottom: "--layout-padding-bottom",
  paddingLeft: "--layout-padding-left",
  paddingRight: "--layout-padding-right",
  background: "--layout-background",
};
/**
 * The page itself: a box the size of what holds it (`100%` both ways), with a
 * background and room kept around its content. What a screen is built on top
 * of, so what is inside it can be laid out against a known area instead of
 * against whatever the document happens to be tall.
 *
 * It only claims 100% of its parent, never of the viewport — so it works the
 * same inside a route, a preview pane or a demo box, and it is up to the page
 * around it to be full-height.
 *
 * @type {import("preact").FunctionComponent<{
 *   padding?: string|number,
 *   paddingTop?: string|number,
 *   paddingBottom?: string|number,
 *   paddingLeft?: string|number,
 *   paddingRight?: string|number,
 *   background?: string,
 * }>}
 * @param {string|number} [props.padding=40] - Room kept between the edges and
 *   the content. The per-side props override it one edge at a time.
 * @param {string} [props.background] - Painted behind everything inside it.
 */
export const ViewportLayout = (props) => {
  import.meta.css = css;
  return (
    <Box
      row
      width="100%"
      height="100%"
      {...props}
      className="navi_viewport_layout"
      styleCSSVars={ViewportLayoutStyleCSSVars}
    />
  );
};
