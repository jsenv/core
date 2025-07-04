import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
// import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

export const InputRadio = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, ActionInputRadio, SimpleInputRadio);
});

const SimpleInputRadio = forwardRef((props, ref) => {
  const { autoFocus, constraints = [], ...rest } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  return <input ref={innerRef} {...rest}></input>;
});

const ActionInputRadio = forwardRef((props, ref) => {
  const {
    id,
    name,
    value,
    autoFocus,
    checked: initialChecked = false,
    constraints = [],
    action,
    disabled,
    onCancel,
    onChange,
    actionPendingEffect = "loading",
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  // const [navStateValue, setNavStateValue] = useNavState(id);
  useOnFormReset(innerRef, () => {
    if (checkedAtStart) {
      // setNavStateValue(value);
    }
  });
  const checkedAtStart = initialChecked; // || navStateValue === value;
  const [, getCheckedValue, setCheckedValue] = useAction(action, {
    name,
    value: checkedAtStart ? value : undefined,
  });
  useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const { pending } = useActionStatus(action);

  const valueChecked = getCheckedValue();
  // le souci avec ça c'est que ca va changer la valeur de qui est check
  // (ca remet celle du haut)
  // qui du coup n'est pas en erreur
  // valueChecked vaut le 2eme radio
  // error vaut null jusqu'a ce quon re-render et la magiquement le second se check
  // alors qu'on voudrait le premier
  // en fait on voudrait le premier check mais l'action courante doit rester le second
  const checked = value === valueChecked;

  const inputRadio = (
    <input
      {...rest}
      ref={innerRef}
      type="radio"
      id={id}
      name={name}
      data-validation-message-arrow-x="center"
      checked={checked}
      disabled={disabled || pending}
      onChange={(e) => {
        const radioIsChecked = e.target.checked;
        if (radioIsChecked) {
          // setNavStateValue(value);
          setCheckedValue(value);
          if (!e.target.form) {
            e.target.requestAction(e);
          }
        }
        // si jamais on uncheck programatiquement il faudrait aussi idéalement
        // pas sur qu'on puisse detecté que rien n'est check, mais si on peut se serai tplus robuste
        onChange?.(e);
      }}
      // eslint-disable-next-line react/no-unknown-property
      oncancel={(e) => {
        e.target.checked = checkedAtStart;
        if (checkedAtStart) {
          // setNavStateValue(value);
        }
        if (onCancel) {
          onCancel();
        }
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onactionstart={onActionStart}
      // eslint-disable-next-line react/no-unknown-property
      onactionerror={(e) => {
        if (initialChecked) {
          setCheckedValue(value);
        }
        onActionError?.(e.detail.error);
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionend={onActionEnd}
    />
  );

  if (actionPendingEffect === "loading") {
    return <LoaderBackground pending={pending}>{inputRadio}</LoaderBackground>;
  }
  return inputRadio;
});
