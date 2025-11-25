import { useContext } from "preact/hooks";

import { withPropsClassName } from "../with_props_class_name.js";
import {
  MessageBoxLevelContext,
  MessageBoxReportTitleChildContext,
} from "./message_box.jsx";
import { Text } from "./text.jsx";

const TitlePseudoClasses = [":hover"];
export const Title = (props) => {
  const messageBoxLevel = useContext(MessageBoxLevelContext);
  const reportTitleToMessageBox = useContext(MessageBoxReportTitleChildContext);
  reportTitleToMessageBox?.(true);

  return (
    <Text
      bold
      className={withPropsClassName("navi_title")}
      as={messageBoxLevel ? "h4" : "h1"}
      marginTop={messageBoxLevel ? "0" : undefined}
      marginBottom={messageBoxLevel ? "sm" : undefined}
      color={messageBoxLevel ? `var(--x-color)` : undefined}
      {...props}
      pseudoClasses={TitlePseudoClasses}
    >
      {props.children}
    </Text>
  );
};
