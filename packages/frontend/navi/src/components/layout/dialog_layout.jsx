// We HAVE TO put paddings around the dialog to ensure window resizing respects this space
// this way even narrow window will show some space around the dialog

import { Box } from "./box.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_dialog_layout {
      --margin: 30px;
      --padding: 20px;
      --background: white;
      --border-width: 2px;
      --border-color: lightgrey;
      --border-radius: 10px;
      --min-width: 300px;
      --min-height: auto;
    }
  }
  .navi_dialog_layout {
    padding-top: var(--margin-top, var(--margin-y, var(--margin)));
    padding-right: var(--margin-right, var(--margin-x, var(--margin)));
    padding-bottom: var(--margin-bottom, var(--margin-y, var(--margin)));
    padding-left: var(--margin-left, var(--margin-x, var(--margin)));
  }

  .navi_dialog_content {
    min-width: var(--min-width);
    min-height: var(--min-height);
    padding-top: var(--padding-top, var(--padding-y, var(--padding)));
    padding-right: var(--padding-right, var(--padding-x, var(--padding)));
    padding-bottom: var(--padding-bottom, var(--padding-y, var(--padding)));
    padding-left: var(--padding-left, var(--padding-x, var(--padding)));
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-width: var(--border-width);
    border-style: solid;
    border-color: var(--border-color);
    border-radius: var(--border-radius);
  }
`;

const DialogManagedByCSSVars = {
  margin: "--margin",
  marginTop: "--margin-top",
  marginBottom: "--margin-bottom",
  marginLeft: "--margin-left",
  marginRight: "--margin-right",
  borderRadius: "--border-radius",
  borderWidth: "--border-width",
  borderColor: "--border-color",
  background: "--background",
  backgroundColor: "--background-color",
  padding: "--padding",
  paddingTop: "--padding-top",
  paddingBottom: "--padding-bottom",
  paddingLeft: "--padding-left",
  paddingRight: "--padding-right",
  minWidth: "--min-width",
  minHeight: "--min-height",
};

export const DialogLayout = ({
  children,
  contentAlignX = "center",
  contentAlignY = "center",
  ...props
}) => {
  return (
    <Box
      className="navi_dialog_layout"
      managedByCSSVars={DialogManagedByCSSVars}
      visualSelector=".navi_dialog_content"
      {...props}
      contentAlignX={contentAlignX}
      contentAlignY={contentAlignY}
    >
      <Box className="navi_dialog_content" row>
        {children}
      </Box>
    </Box>
  );
};
