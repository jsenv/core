import { useContext, useRef } from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { FormContext } from "../form_context.js";
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
  const form = useContext(FormContext);

  if (props.type === "submit") {
    props.type = "button";
    props.command = props.command || "--navi-send";
  }
  const command = props.command;

  // A send with nothing to send does nothing (see Form's own sendUnchanged), and
  // a button that visibly does nothing when pressed reads as broken. Read-only
  // says so before the press; what it says on the press is READONLY_CONSTRAINT's
  // own business, and it recognises this case. Interactive again the moment a
  // field changes.
  //
  // Passed to Next rather than written onto props like everything else here:
  // this one answers to something outside the button and flips back, and the
  // props object outlives the render (a button inside a form is the same vnode
  // when the form re-renders around it), so a write would never be undone.
  const readOnly =
    command === "--navi-send" && form?.nothingToSend ? true : props.readOnly;

  // Called fresh on every render (not a module-level object computed once
  // at import time) — naviI18n(...) must be re-evaluated per call so a
  // Button using a command's built-in default label actually follows
  // setPreferredLanguage()/a "languagechange" event instead of staying
  // stuck with whatever language was active the first time this module was
  // imported.
  const getCommandDefaultProps = COMMAND_DEFAULT_PROPS_FACTORIES[command];
  if (getCommandDefaultProps) {
    const commandDefaultProps = getCommandDefaultProps();
    for (const key of Object.keys(commandDefaultProps)) {
      if (props[key] === undefined) {
        props[key] = commandDefaultProps[key];
      }
    }
  }

  return <Next {...props} readOnly={readOnly} />;
};
const COMMAND_DEFAULT_PROPS_FACTORIES = {
  "--navi-clear": () => ({
    children: naviI18n("button.clear"),
  }),
  "--navi-reset": () => ({
    children: naviI18n("button.reset"),
  }),
  "--navi-define": () => ({
    children: naviI18n("button.define"),
  }),
  "--navi-send": () => ({
    children: naviI18n("button.send"),
    cta: true,
  }),
  "--navi-cancel": () => ({
    children: naviI18n("button.cancel"),
  }),
  "--navi-close": () => ({
    children: naviI18n("button.close"),
  }),
  "--navi-open": () => ({
    children: naviI18n("button.open"),
  }),
};

export const Button = createComponentResolver([
  ButtonFirstResolver,
  ButtonRouteResolver,
  ButtonCommandPropResolver,
  ButtonUI,
]);
