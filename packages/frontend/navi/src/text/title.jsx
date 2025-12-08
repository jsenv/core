import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { withPropsClassName } from "../utils/with_props_class_name.js";
import {
  MessageBoxReportTitleChildContext,
  MessageBoxStatusContext,
} from "./message_box.jsx";
import { Text } from "./text.jsx";

export const TitleLevelContext = createContext();
export const useTitleLevel = () => {
  return useContext(TitleLevelContext);
};
const TitlePseudoClasses = [":hover"];
export const Title = (props) => {
  const messageBoxStatus = useContext(MessageBoxStatusContext);
  const innerAs = props.as || (messageBoxStatus ? "h4" : "h1");
  const titleLevel = parseInt(innerAs.slice(1));
  const reportTitleToMessageBox = useContext(MessageBoxReportTitleChildContext);
  reportTitleToMessageBox?.(true);

  return (
    <TitleLevelContext.Provider value={titleLevel}>
      <Text
        bold
        className={withPropsClassName("navi_title")}
        as={messageBoxStatus ? "h4" : "h1"}
        marginTop={messageBoxStatus ? "0" : undefined}
        marginBottom={messageBoxStatus ? "s" : undefined}
        color={messageBoxStatus ? `var(--x-color)` : undefined}
        {...props}
        pseudoClasses={TitlePseudoClasses}
      >
        {props.children}
      </Text>
    </TitleLevelContext.Provider>
  );
};
