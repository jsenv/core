import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

export const InputCheckbox = forwardRef((props, ref) => {
  return renderActionComponent(
    props,
    ref,
    ActionInputCheckbox,
    SimpleInputCheckbox,
  );
});

const SimpleInputCheckbox = forwardRef((props, ref) => {
  const { autoFocus, constraints = [], ...rest } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  return <input ref={innerRef} {...rest} />;
});

const ActionInputCheckbox = forwardRef((props, ref) => {
  const {
    id,
    name,
    value = "on",
    autoFocus,
    checked: initialChecked = false,
    constraints = [],
    action,
    disabled,
    onCancel,
    onInput,
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

  const [navStateValue, setNavStateValue] = useNavState(id);
  useOnFormReset(innerRef, () => {
    setNavStateValue(undefined);
  });
  const checkedAtStart =
    navStateValue === undefined ? initialChecked : navStateValue;

  const [effectiveAction, getChecked, setChecked] = useAction(action, {
    name,
    value: checkedAtStart ? value : undefined,
  });
  const { pending, error, aborted } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  // s'il a sa propre action on pourrait quand meme vouloir une structure
  // on pars du principe qu'il est solo
  // mais dans le cas d'un form on ne sait pas en vrai
  // hummmmm
  // je pense qu'il faut parser le dom pour savoir
  // on regarde s'il est dans un form
  // sinon dans un fieldset
  // et on regarde si dans cet element il y en a d'autre avec le meme nom

  const checkedFromSignal = getChecked();
  const checked = error || aborted ? initialChecked : checkedFromSignal;

  const inputCheckbox = (
    <input
      {...rest}
      ref={innerRef}
      type="checkbox"
      id={id}
      name={name}
      value={value}
      data-validation-message-arrow-x="center"
      checked={checked}
      disabled={disabled || pending}
      // eslint-disable-next-line react/no-unknown-property
      oncancel={(e) => {
        if (e.detail === "blur_invalid") {
          return;
        }
        e.target.checked = checked;
        setNavStateValue(checkedAtStart);
        if (onCancel) {
          onCancel();
        }
      }}
      onInput={(e) => {
        const checkboxIsChecked = e.target.checked;
        if (checkedAtStart) {
          setNavStateValue(checkboxIsChecked ? false : undefined);
        } else {
          setNavStateValue(checkboxIsChecked ? true : undefined);
        }
        setChecked(checkboxIsChecked ? value : undefined);
        onInput?.(e);
        if (action) {
          e.target.requestAction(e);
        }
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={(actionEvent) => {
        if (action) {
          executeAction(effectiveAction, {
            requester: actionEvent.target,
          });
        }
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionstart={onActionStart}
      // eslint-disable-next-line react/no-unknown-property
      onactionerror={onActionError}
      // eslint-disable-next-line react/no-unknown-property
      onactionend={() => {
        setNavStateValue(undefined);
        onActionEnd?.();
      }}
    />
  );

  if (actionPendingEffect === "loading") {
    return (
      <LoaderBackground pending={pending}>{inputCheckbox}</LoaderBackground>
    );
  }
  return inputCheckbox;
});
