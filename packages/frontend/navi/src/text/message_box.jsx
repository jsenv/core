import { createContext } from "preact";
import { useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
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
      --background-color-info: var(--navi-info-color-light);
      --color-info: var(--navi-info-color);
      --background-color-success: var(--navi-success-color-light);
      --color-success: var(--navi-success-color);
      --background-color-warning: var(--navi-warning-color-light);
      --color-warning: var(--navi-warning-color);
      --background-color-error: var(--navi-error-color-light);
      --color-error: var(--navi-error-color);
    }
  }

  .navi_message_box {
    --x-background-color: var(--background-color-info);
    --x-color: var(--color-info);
    /* color: var(--x-color); */
    background-color: var(--x-background-color);
  }

  .navi_message_box[data-status-info] {
    --x-background-color: var(--background-color-info);
    --x-color: var(--color-info);
  }
  .navi_message_box[data-status-success] {
    --x-background-color: var(--background-color-success);
    --x-color: var(--color-success);
  }
  .navi_message_box[data-status-warning] {
    --x-background-color: var(--background-color-warning);
    --x-color: var(--color-warning);
  }
  .navi_message_box[data-status-error] {
    --x-background-color: var(--background-color-error);
    --x-color: var(--color-error);
  }

  .navi_message_box[data-left-stripe] {
    border-left: 6px solid var(--x-color);
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
  }
`;

const MessageBoxPseudoClasses = [
  ":-navi-status-info",
  ":-navi-status-success",
  ":-navi-status-warning",
  ":-navi-status-error",
];
export const MessageBoxStatusContext = createContext();
export const MessageBoxReportTitleChildContext = createContext();
export const MessageBox = ({
  status = "info",
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
      status === "info" ? (
        <InfoSvg />
      ) : status === "success" ? (
        <SuccessSvg />
      ) : status === "warning" ? (
        <WarningSvg />
      ) : status === "error" ? (
        <ErrorSvg />
      ) : null;
  } else if (typeof icon === "function") {
    const Comp = icon;
    icon = <Comp />;
  }

  return (
    <Box
      as="div"
      role={status === "info" ? "status" : "alert"}
      data-left-stripe={innerLeftStripe ? "" : undefined}
      inline
      column
      alignY="start"
      spacing="sm"
      {...rest}
      className={withPropsClassName("navi_message_box", rest.className)}
      padding={padding}
      pseudoClasses={MessageBoxPseudoClasses}
      basePseudoState={{
        ":-navi-status-info": status === "info",
        ":-navi-status-success": status === "success",
        ":-navi-status-warning": status === "warning",
        ":-navi-status-error": status === "error",
      }}
    >
      <MessageBoxStatusContext.Provider value={status}>
        <MessageBoxReportTitleChildContext.Provider value={setHasTitleChild}>
          {icon && <Icon color="var(--x-color)">{icon}</Icon>}
          <Text>{children}</Text>
          {onClose && (
            <Button
              action={onClose}
              discrete
              icon
              border="none"
              data-nohover=""
              alignX="center"
              alignY="center"
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
      </MessageBoxStatusContext.Provider>
    </Box>
  );
};
