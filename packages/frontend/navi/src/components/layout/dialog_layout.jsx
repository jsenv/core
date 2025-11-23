// We HAVE TO put paddings around the dialog to ensure window resizing respects this space
// this way even narrow window will show some space around the dialog

import { Box } from "./box.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_dialog_layout {
      --layout-margin: 30px;
      --layout-padding: 20px;
      --layout-background: white;
      --layout-border-width: 2px;
      --layout-border-color: lightgrey;
      --layout-border-radius: 10px;
      --layout-min-width: 300px;
      --layout-min-height: auto;
    }
  }
  .navi_dialog_layout {
    padding-top: var(
      --layout-margin-top,
      var(--layout-margin-y, var(--layout-margin))
    );
    padding-right: var(
      --layout-margin-right,
      var(--layout-margin-x, var(--layout-margin))
    );
    padding-bottom: var(
      --layout-margin-bottom,
      var(--layout-margin-y, var(--layout-margin))
    );
    padding-left: var(
      --layout-margin-left,
      var(--layout-margin-x, var(--layout-margin))
    );
  }

  .navi_dialog_content {
    min-width: var(--layout-min-width);
    min-height: var(--layout-min-height);
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
    background-color: var(--layout-background-color, var(--layout-background));
    border-width: var(--layout-border-width);
    border-style: solid;
    border-color: var(--layout-border-color);
    border-radius: var(--layout-border-radius);
  }
`;

const DialogLayoutStyleCSSVars = {
  margin: "--layout-margin",
  marginTop: "--layout-margin-top",
  marginBottom: "--layout-margin-bottom",
  marginLeft: "--layout-margin-left",
  marginRight: "--layout-margin-right",
  borderRadius: "--layout-border-radius",
  borderWidth: "--layout-border-width",
  borderColor: "--layout-border-color",
  background: "--layout-background",
  backgroundColor: "--layout-background-color",
  padding: "--layout-padding",
  paddingTop: "--layout-padding-top",
  paddingBottom: "--layout-padding-bottom",
  paddingLeft: "--layout-padding-left",
  paddingRight: "--layout-padding-right",
  minWidth: "--layout-min-width",
  minHeight: "--layout-min-height",
};
export const DialogLayout = ({
  children,
  alignX = "center",
  alignY = "center",
  ...props
}) => {
  return (
    <Box
      baseClassName="navi_dialog_layout"
      CSSVars={DialogLayoutStyleCSSVars}
      visualSelector=".navi_dialog_content"
      {...props}
    >
      <Box row className="navi_dialog_content" alignX={alignX} alignY={alignY}>
        {children}
      </Box>
    </Box>
  );
};
