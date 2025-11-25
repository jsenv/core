import { useContext } from "preact/hooks";

import { LinkAnchor } from "./link_anchor.jsx";
import {
  MessageBoxLevelContext,
  MessageBoxReportTitleChildContext,
} from "./message_box.jsx";
import { Text } from "./text.jsx";

export const Title = (props) => {
  const messageBoxLevel = useContext(MessageBoxLevelContext);
  const reportTitleToMessageBox = useContext(MessageBoxReportTitleChildContext);
  reportTitleToMessageBox?.(true);

  return (
    <Text
      bold
      as={messageBoxLevel ? "h4" : "h1"}
      marginTop={messageBoxLevel ? "0" : undefined}
      marginBottom={messageBoxLevel ? "sm" : undefined}
      color={messageBoxLevel ? `var(--x-color)` : undefined}
      {...props}
    >
      {props.id && (
        <LinkAnchor href={`#${props.id}`} aria-label="Permalink to title" />
      )}
      {props.children}
    </Text>
  );
};
