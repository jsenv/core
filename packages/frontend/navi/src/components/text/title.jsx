import { Box } from "../layout/box.jsx";
import { applyContentSpacingOnTextChildren } from "./text.jsx";

export const Title = ({
  as = "h1",
  bold = true,
  contentSpacing = " ",
  children,
  ...rest
}) => {
  return (
    <Box {...rest} as={as} bold={bold}>
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
    </Box>
  );
};
