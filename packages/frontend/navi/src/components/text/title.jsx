import { useContext } from "preact/hooks";

import { Box } from "../layout/box.jsx";
import {
  MessageBoxLevelContext,
  MessageBoxReportTitleChildContext,
} from "./message_box.jsx";

export const Title = (props) => {
  const messageBoxLevel = useContext(MessageBoxLevelContext);
  const reportTitleToMessageBox = useContext(MessageBoxReportTitleChildContext);
  reportTitleToMessageBox?.(true);

  return (
    <Box
      bold
      as={messageBoxLevel ? "h4" : "h1"}
      marginTop={messageBoxLevel ? "0" : undefined}
      marginBottom={messageBoxLevel ? "sm" : undefined}
      color={messageBoxLevel ? `var(--x-color)` : undefined}
      {...props}
    />
  );
};
