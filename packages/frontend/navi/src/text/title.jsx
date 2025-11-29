import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { withPropsClassName } from "../with_props_class_name.js";
import {
  MessageBoxLevelContext,
  MessageBoxReportTitleChildContext,
} from "./message_box.jsx";
import { Text } from "./text.jsx";

export const TitleLevelContext = createContext();
const TitlePseudoClasses = [":hover"];
export const Title = (props) => {
  const messageBoxLevel = useContext(MessageBoxLevelContext);
  const innerAs = props.as || (messageBoxLevel ? "h4" : "h1");
  const titleLevel = parseInt(innerAs.slice(1));
  const reportTitleToMessageBox = useContext(MessageBoxReportTitleChildContext);
  reportTitleToMessageBox?.(true);

  return (
    <TitleLevelContext.Provider value={titleLevel}>
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
    </TitleLevelContext.Provider>
  );
};
