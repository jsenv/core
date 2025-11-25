import { useContext } from "preact/hooks";

import { LinkAnchor } from "./link_anchor.jsx";
import {
  MessageBoxLevelContext,
  MessageBoxReportTitleChildContext,
} from "./message_box.jsx";
import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  .navi_title_anchor {
    position: absolute !important;
    top: 50%;
    left: -1em;
    width: 1em;
    height: 1em;
    font-size: 0.7em;
    opacity: 0;
    transform: translateY(-50%);
  }

  .navi_title_anchor:focus,
  .navi_title_anchor:focus-visible {
    opacity: 1;
  }

  .navi_title:hover .navi_title_anchor {
    opacity: 1;
  }
`;

const TitlePseudoClasses = [":hover"];
export const Title = ({ id, ...props }) => {
  const messageBoxLevel = useContext(MessageBoxLevelContext);
  const reportTitleToMessageBox = useContext(MessageBoxReportTitleChildContext);
  reportTitleToMessageBox?.(true);

  return (
    <Text
      bold
      className="navi_title"
      as={messageBoxLevel ? "h4" : "h1"}
      marginTop={messageBoxLevel ? "0" : undefined}
      marginBottom={messageBoxLevel ? "sm" : undefined}
      color={messageBoxLevel ? `var(--x-color)` : undefined}
      {...props}
      pseudoClasses={TitlePseudoClasses}
    >
      {id && (
        <LinkAnchor
          id={id}
          className="navi_title_anchor"
          href={`#${id}`}
          aria-label="Permalink to title"
        />
      )}
      {props.children}
    </Text>
  );
};
