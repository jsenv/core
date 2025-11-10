import { Box } from "../layout/box.jsx";
import { applyContentSpacingOnTextChildren } from "./text.jsx";

export const Code = ({ contentSpacing = " ", children, ...rest }) => {
  return (
    <Box {...rest} as="code">
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
    </Box>
  );
};
