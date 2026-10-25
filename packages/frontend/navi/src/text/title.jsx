import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { withPropsClassName } from "../utils/with_props_class_name.js";
import {
  MessageBoxReportTitleChildContext,
  MessageBoxStatusContext,
} from "./message_box.jsx";
import { Text } from "./text.jsx";

const css = /* css */ `
  .navi_message_box {
    .navi_title {
      margin-top: 0;
      margin-bottom: var(--navi-s);
      color: var(--x-message-color);
    }
  }
`;

/**
 * A heading: bold, on a heading element. It accepts every `Text` prop on top
 * of the ones below.
 *
 * @type {import("preact").FunctionComponent<{
 *   children?: import("preact").ComponentChildren,
 *   as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
 *   size?: string | number,
 *   [key: string]: any,
 * }>}
 *
 * @param {"h1"|"h2"|"h3"|"h4"|"h5"|"h6"} [as]
 *   The heading's level, for the page's outline and for a screen reader:
 *   `"h1"` by default, `"h4"` inside a `MessageBox`; what the title holds
 *   reads it through `useTitleLevel()`. There is no `level` prop.
 *
 * @param {string|number} [size]
 *   The font size, when it is not the one the browser gives the level: a
 *   section titled `as="h3"` that should read larger, or smaller.
 */
export const Title = (props) => {
  import.meta.css = css;
  if (import.meta.dev && Object.hasOwn(props, "level")) {
    console.warn(
      `Title: "level" is not a prop, the level is the tag. Write as="h${props.level}".`,
    );
  }
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
        {...props}
        pseudoClasses={TitlePseudoClasses}
      >
        {props.children}
      </Text>
    </TitleLevelContext.Provider>
  );
};
export const TitleLevelContext = createContext();
export const useTitleLevel = () => {
  return useContext(TitleLevelContext);
};
const TitlePseudoClasses = [":hover"];
