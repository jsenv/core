import { createContext } from "preact";

import { Box } from "../layout/box.jsx";
import { applyContentSpacingOnTextChildren } from "./text.jsx";

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
      padding={padding}
    >
      <MessageBoxLevelContext.Provider value={level}>
        {applyContentSpacingOnTextChildren(children, contentSpacing)}
      </MessageBoxLevelContext.Provider>
    </Box>
  );
};
