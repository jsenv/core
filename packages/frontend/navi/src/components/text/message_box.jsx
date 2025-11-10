import { createContext } from "preact";

import { Box } from "../layout/box.jsx";
import { PSEUDO_CLASSES } from "../layout/pseudo_styles.js";
import { applyContentSpacingOnTextChildren } from "./text.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_message_box {
      --background-color-info: rgb(234, 246, 252);
      --color-info: rgb(9, 83, 191);
      --background-color-success: rgb(65, 196, 100);
      --color-success: rgb(42, 126, 65);
      --background-color-warning: rgb(249, 157, 2);
      --color-warning: rgb(222, 95, 12);
      --background-color-error: rgb(235, 54, 75);
      --color-error: rgb(188, 43, 60);
    }
  }

  .navi_message_box {
    --x-background-color: var(--background-color-info);
    --x-color: var(--color-info);
    /* color: var(--x-color); */
    background-color: var(--x-background-color);
  }

  .navi_message_box[data-level="info"] {
    --x-background-color: var(--background-color-info);
    --x-color: var(--color-info);
  }
  .navi_message_box[data-level="success"] {
    --x-background-color: var(--background-color-success);
    --x-color: var(--color-success);
  }
  .navi_message_box[data-level="warning"] {
    --x-background-color: var(--background-color-warning);
    --x-color: var(--color-warning);
  }
  .navi_message_box[data-level="error"] {
    --x-background-color: var(--background-color-error);
    --x-color: var(--color-error);
  }
`;

Object.assign(PSEUDO_CLASSES, {
  ":-navi-message-level": {
    attribute: "data-level",
  },
});

export const MessageBoxLevelContext = createContext();

export const MessageBox = ({
  level = "info",
  padding = "sm",
  contentSpacing = " ",
  children,
  ...rest
}) => {
  return (
    <Box
      as="div"
      role={level === "info" ? "status" : "alert"}
      {...rest}
      baseClassName="navi_message_box"
      padding={padding}
      pseudoState={{
        ":-navi-message-level": level,
      }}
    >
      <MessageBoxLevelContext.Provider value={level}>
        {applyContentSpacingOnTextChildren(children, contentSpacing)}
      </MessageBoxLevelContext.Provider>
    </Box>
  );
};
