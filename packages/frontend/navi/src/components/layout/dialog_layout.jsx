// We HAVE TO put paddings around the dialog to ensure window resizing respects this space
// this way even narrow window will show some space around the dialog

import { Box } from "./box.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_dialog_layout {
      --dialog-margin: 30px;
      --dialog-padding: 20px;
      --dialog-background: white;
      --dialog-border-width: 2px;
      --dialog-border-color: lightgrey;
      --dialog-border-radius: 10px;
      --dialog-min-width: 300px;
      --dialog-min-height: auto;
    }
  }
  .navi_dialog_layout {
    padding-top: var(
      --dialog-margin-top,
      var(--dialog-margin-y, var(--dialog-margin))
    );
    padding-right: var(
      --dialog-margin-right,
      var(--dialog-margin-x, var(--dialog-margin))
    );
    padding-bottom: var(
      --dialog-margin-bottom,
      var(--dialog-margin-y, var(--dialog-margin))
    );
    padding-left: var(
      --dialog-margin-left,
      var(--dialog-margin-x, var(--dialog-margin))
    );
  }

  .navi_dialog_content {
    min-width: var(--dialog-min-width);
    min-height: var(--dialog-min-height);
    padding-top: var(
      --dialog-padding-top,
      var(--dialog-padding-y, var(--dialog-padding))
    );
    padding-right: var(
      --dialog-padding-right,
      var(--dialog-padding-x, var(--dialog-padding))
    );
    padding-bottom: var(
      --dialog-padding-bottom,
      var(--dialog-padding-y, var(--dialog-padding))
    );
    padding-left: var(
      --dialog-padding-left,
      var(--dialog-padding-x, var(--dialog-padding))
    );
    background: var(--dialog-background);
    background-color: var(--dialog-background-color, var(--dialog-background));
    border-width: var(--dialog-border-width);
    border-style: solid;
    border-color: var(--dialog-border-color);
    border-radius: var(--dialog-border-radius);
  }
`;

const DialogManagedByCSSVars = {
  margin: "--dialog-margin",
  marginTop: "--dialog-margin-top",
  marginBottom: "--dialog-margin-bottom",
  marginLeft: "--dialog-margin-left",
  marginRight: "--dialog-margin-right",
  borderRadius: "--dialog-border-radius",
  borderWidth: "--dialog-border-width",
  borderColor: "--dialog-border-color",
  background: "--dialog-background",
  backgroundColor: "--dialog-background-color",
  padding: "--dialog-padding",
  paddingTop: "--dialog-padding-top",
  paddingBottom: "--dialog-padding-bottom",
  paddingLeft: "--dialog-padding-left",
  paddingRight: "--dialog-padding-right",
  minWidth: "--dialog-min-width",
  minHeight: "--dialog-min-height",
};

export const DialogLayout = ({
  children,
  contentAlignX = "center",
  contentAlignY = "center",
  ...props
}) => {
  return (
    <Box
      baseClassName="navi_dialog_layout"
      managedByCSSVars={DialogManagedByCSSVars}
      visualSelector=".navi_dialog_content"
      {...props}
    >
      <Box
        row
        className="navi_dialog_content"
        contentAlignX={contentAlignX}
        contentAlignY={contentAlignY}
      >
        {children}
      </Box>
    </Box>
  );
};
