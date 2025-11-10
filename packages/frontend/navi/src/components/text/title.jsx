import { useContext } from "preact/hooks";

import { Box } from "../layout/box.jsx";
import { MessageBoxLevelContext } from "./message_box.jsx";
import { applyContentSpacingOnTextChildren } from "./text.jsx";

export const Title = ({
  as = "h1",
  bold = true,
  contentSpacing = " ",
  color,
  children,
  ...rest
}) => {
  const messageBoxLevel = useContext(MessageBoxLevelContext);
  const innerColor =
    color === undefined
      ? messageBoxLevel
        ? `var(--x-color)`
        : undefined
      : color;

  return (
    <Box {...rest} as={as} bold={bold} color={innerColor}>
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
    </Box>
  );
};
