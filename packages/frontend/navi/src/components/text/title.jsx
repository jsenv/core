import { useContext } from "preact/hooks";

import { Box } from "../layout/box.jsx";
import {
  MessageBoxLevelContext,
  MessageBoxReportTitleChildContext,
} from "./message_box.jsx";
import { applyContentSpacingOnTextChildren } from "./text.jsx";

export const Title = ({
  as,
  bold = true,
  contentSpacing = " ",
  color,
  children,
  marginTop,
  marginBottom,
  ...rest
}) => {
  const messageBoxLevel = useContext(MessageBoxLevelContext);
  const reportTitleToMessageBox = useContext(MessageBoxReportTitleChildContext);
  const innerColor =
    color === undefined
      ? messageBoxLevel
        ? `var(--x-color)`
        : undefined
      : color;
  const innerAs = as === undefined ? (messageBoxLevel ? "h4" : "h1") : as;
  reportTitleToMessageBox?.(true);

  const innerMarginTop =
    marginTop === undefined ? (messageBoxLevel ? "0" : undefined) : marginTop;
  const innerMarginBottom =
    marginBottom === undefined
      ? messageBoxLevel
        ? "8px"
        : undefined
      : marginBottom;

  return (
    <Box
      {...rest}
      as={innerAs}
      bold={bold}
      color={innerColor}
      marginTop={innerMarginTop}
      marginBottom={innerMarginBottom}
    >
      {applyContentSpacingOnTextChildren(children, contentSpacing)}
    </Box>
  );
};
