import { createContext } from "preact";
import { useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { PSEUDO_CLASSES } from "../box/pseudo_styles.js";
import { Button } from "../field/button.jsx";
import { Icon } from "../graphic/icon.jsx";
import { CloseSvg } from "../graphic/icons/close_svg.jsx";
import {
  ErrorSvg,
  InfoSvg,
  SuccessSvg,
  WarningSvg,
} from "../graphic/icons/level_svg.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";
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
  onClose,
  ...rest
}) => {
  const [hasTitleChild, setHasTitleChild] = useState(false);
  const innerLeftStripe = leftStripe === undefined ? hasTitleChild : leftStripe;
  if (icon === true) {
    icon =
      level === "info" ? (
        <InfoSvg />
      ) : level === "success" ? (
        <SuccessSvg />
      ) : level === "warning" ? (
        <WarningSvg />
      ) : level === "error" ? (
        <ErrorSvg />
      ) : null;
  } else if (typeof icon === "function") {
    const Comp = icon;
    icon = <Comp />;
  }

  return (
    <Box
      as="div"
      role={level === "info" ? "status" : "alert"}
      data-left-stripe={innerLeftStripe ? "" : undefined}
      column
      alignY="start"
      spacing="sm"
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
      <MessageBoxLevelContext.Provider value={level}>
        <MessageBoxReportTitleChildContext.Provider value={setHasTitleChild}>
          {icon && <Icon color="var(--x-color)">{icon}</Icon>}
          <Text>{children}</Text>
          {onClose && (
            <Button
              action={onClose}
              discrete
              border="none"
              data-nohover=""
              alignX="center"
              alignY="center"
              width="1em"
              height="1em"
              pseudoStyle={{
                ":hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.1)",
                },
              }}
            >
              <Icon>
                <CloseSvg />
              </Icon>
            </Button>
          )}
        </MessageBoxReportTitleChildContext.Provider>
      </MessageBoxLevelContext.Provider>
    </Box>
  );
};
