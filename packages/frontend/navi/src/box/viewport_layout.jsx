import { Box } from "./box.jsx";

import.meta.css = /* css */ `
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
export const ViewportLayout = (props) => {
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
