import { createContext } from "preact";
import { useState } from "preact/hooks";

import {
  ErrorIconSvg,
  InfoIconSvg,
  SuccessIconSvg,
  WarningIconSvg,
} from "../graphic/level_svgs.jsx";
import { PSEUDO_CLASSES } from "../layout/pseudo_styles.js";
import { withPropsClassName } from "../with_props_class_name.js";
import { Icon } from "./icon.jsx";
import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_message_box {
      --background-color-info: #eaf6fc;
      --color-info: #376cc2;
      --background-color-success: #ecf9ef;
      --color-success: #50c464;
      --background-color-warning: #fdf6e3;
      --color-warning: #f19c05;
      --background-color-error: #fcebed;
      --color-error: #eb364b;
    }
  }

  .navi_message_box {
    --x-background-color: var(--background-color-info);
    --x-color: var(--color-info);
    /* color: var(--x-color); */
    background-color: var(--x-background-color);
  }

  .navi_message_box[data-level="info"] {
    --x-background-color: var(--background-color-info);
    --x-color: var(--color-info);
  }
  .navi_message_box[data-level="success"] {
    --x-background-color: var(--background-color-success);
    --x-color: var(--color-success);
  }
  .navi_message_box[data-level="warning"] {
    --x-background-color: var(--background-color-warning);
    --x-color: var(--color-warning);
  }
  .navi_message_box[data-level="error"] {
    --x-background-color: var(--background-color-error);
    --x-color: var(--color-error);
  }

  .navi_message_box[data-left-stripe] {
    border-left: 6px solid var(--x-color);
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
  }
`;

Object.assign(PSEUDO_CLASSES, {
  ":-navi-info": {
    add: (el) => {
      el.setAttribute("data-level", "info");
    },
    remove: (el) => {
      if (el.getAttribute("data-level") === "info") {
        el.removeAttribute("data-level");
      }
    },
  },
  ":-navi-success": {
    add: (el) => {
      el.setAttribute("data-level", "success");
    },
    remove: (el) => {
      if (el.getAttribute("data-level") === "success") {
        el.removeAttribute("data-level");
      }
    },
  },
  ":-navi-warning": {
    add: (el) => {
      el.setAttribute("data-level", "warning");
    },
    remove: (el) => {
      if (el.getAttribute("data-level") === "warning") {
        el.removeAttribute("data-level");
      }
    },
  },
  ":-navi-error": {
    add: (el) => {
      el.setAttribute("data-level", "error");
    },
    remove: (el) => {
      if (el.getAttribute("data-level") === "error") {
        el.removeAttribute("data-level");
      }
    },
  },
});
const MessageBoxPseudoClasses = [
  ":-navi-info",
  ":-navi-success",
  ":-navi-warning",
  ":-navi-error",
];

export const MessageBoxLevelContext = createContext();
export const MessageBoxReportTitleChildContext = createContext();

export const MessageBox = ({
  level = "info",
  padding = "sm",
  icon,
  leftStripe,
  children,
  ...rest
}) => {
  const [hasTitleChild, setHasTitleChild] = useState(false);
  const innerLeftStripe = leftStripe === undefined ? hasTitleChild : leftStripe;
  let IconComponent;
  if (icon === true) {
    IconComponent =
      level === "info"
        ? InfoIconSvg
        : level === "success"
          ? SuccessIconSvg
          : level === "warning"
            ? WarningIconSvg
            : level === "error"
              ? ErrorIconSvg
              : null;
  }

  return (
    <MessageBoxLevelContext.Provider value={level}>
      <MessageBoxReportTitleChildContext.Provider value={setHasTitleChild}>
        <Text
          as="div"
          role={level === "info" ? "status" : "alert"}
          data-left-stripe={innerLeftStripe ? "" : undefined}
          {...rest}
          className={withPropsClassName("navi_message_box", rest.className)}
          padding={padding}
          pseudoClasses={MessageBoxPseudoClasses}
          basePseudoState={{
            ":-navi-info": level === "info",
            ":-navi-success": level === "success",
            ":-navi-warning": level === "warning",
            ":-navi-error": level === "error",
          }}
        >
          {IconComponent && (
            <Icon color="var(--x-color)">
              <IconComponent />
            </Icon>
          )}
          {children}
        </Text>
      </MessageBoxReportTitleChildContext.Provider>
    </MessageBoxLevelContext.Provider>
  );
};
