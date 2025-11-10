import { useContext } from "preact/hooks";

import { Box } from "../layout/box.jsx";
import { MessageBoxLevelContext } from "./message_box.jsx";
import { applyContentSpacingOnTextChildren } from "./text.jsx";

export const Title = ({
  as,
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
  const innerAs = as === undefined ? (messageBoxLevel ? "h4" : "h1") : as;

  return (
    <Box {...rest} as={innerAs} bold={bold} color={innerColor}>
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
    </Box>
  );
};
