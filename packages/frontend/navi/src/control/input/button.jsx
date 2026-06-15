import { useRef } from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { ButtonInsideFormResolver } from "./button_inside_form.jsx";
import { ButtonRouteResolver } from "./button_route.jsx";
import { ButtonUI } from "./button_ui.jsx";

const ButtonFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;

  return <Next {...props} />;
};

export const Button = createComponentResolver([
  ButtonFirstResolver,
  ButtonRouteResolver,
  ButtonInsideFormResolver,
  ButtonUI,
]);

const ButtonClear = (props) => {
  return (
    <Button
      command="--navi-clear"
      // eslint-disable-next-line react/no-children-prop
      children={naviI18n("button.clear")}
      {...props}
    />
  );
};
const ButtonCancel = (props) => {
  return (
    <Button
      command="--navi-cancel"
      // eslint-disable-next-line react/no-children-prop
      children={naviI18n("button.cancel")}
      {...props}
    />
  );
};
const ButtonDefine = (props) => {
  return (
    <Button
      command="--navi-send"
      // eslint-disable-next-line react/no-children-prop
      children={naviI18n("button.define")}
      {...props}
    />
  );
};
const ButtonOk = (props) => {
  return (
    <Button
      command="--navi-send"
      // eslint-disable-next-line react/no-children-prop
      children={naviI18n("button.ok")}
      cta
      {...props}
    />
  );
};
const ButtonReset = (props) => {
  return (
    <Button
      command="--navi-reset"
      // eslint-disable-next-line react/no-children-prop
      children={naviI18n("button.reset")}
      {...props}
    />
  );
};
const ButtonSend = (props) => {
  return (
    <Button
      command="--navi-send"
      // eslint-disable-next-line react/no-children-prop
      children={naviI18n("button.send")}
      cta
      {...props}
    />
  );
};

Button.Clear = ButtonClear;
Button.Cancel = ButtonCancel;
Button.Define = ButtonDefine;
Button.Reset = ButtonReset;
Button.Send = ButtonSend;
Button.Ok = ButtonOk;
