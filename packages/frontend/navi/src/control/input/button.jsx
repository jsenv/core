import { useRef } from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { ButtonRouteResolver } from "./button_route.jsx";
import { ButtonUI } from "./button_ui.jsx";

const ButtonFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;

  return <Next {...props} />;
};

const ButtonCommandPropResolver = (props) => {
  const Next = useNextResolver();

  if (props.type === "submit") {
    props.type = "button";
    props.command = props.command || "--navi-send";
  }
  const command = props.command;

  const commandDefaultProps = COMMAND_DEFAULT_PROPS[command];
  if (commandDefaultProps) {
    for (const key of Object.keys(commandDefaultProps)) {
      if (props[key] === undefined) {
        props[key] = commandDefaultProps[key];
      }
    }
  }

  return <Next {...props} />;
};
const COMMAND_DEFAULT_PROPS = {
  "--navi-clear": {
    children: naviI18n("button.clear"),
  },
  "--navi-reset": {
    children: naviI18n("button.reset"),
  },
  "--navi-define": {
    children: naviI18n("button.define"),
  },
  "--navi-send": {
    children: naviI18n("button.send"),
    cta: true,
  },
  "--navi-cancel": {
    children: naviI18n("button.cancel"),
  },
  "--navi-close": {
    children: naviI18n("button.close"),
  },
  "--navi-open": {
    children: naviI18n("button.open"),
  },
};

export const Button = createComponentResolver([
  ButtonFirstResolver,
  ButtonRouteResolver,
  ButtonCommandPropResolver,
  ButtonUI,
]);
