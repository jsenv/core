import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
import { useAction } from "../action_execution/use_action.js";
import { useActionSingleParamSignal } from "../action_execution/use_action_params_signal.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

import.meta.css = /*css*/ `
  label[data-disabled] {
    opacity: 0.5;
  }
`;

export const InputCheckbox = forwardRef((props, ref) => {
  return renderActionComponent(
    props,
    ref,
    ActionInputCheckbox,
    SimpleInputCheckbox,
  );
});

const ActionInputCheckbox = forwardRef(
  (
    {
      id,
      name,
      autoFocus,
      checked: initialChecked = false,
      constraints = [],
      action,
      parentAction,
      label,
      disabled,
      pendingEffect = "loading",
      pendingTarget = "input", // "input" or "label"
      onCancel,
      onInput,
      onActionStart,
      onActionError,
      onActionEnd,
      ...rest
    },
    ref,
  ) => {
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

    const [checkedParamsSignal, getParamSignalValue, setParamSignalValue] =
      useActionSingleParamSignal(action, checkedAtStart, name);
    const boundAction = useAction(action, checkedParamsSignal);
    const effectiveAction = boundAction || parentAction;

    const { pending, error, aborted } = useActionStatus(effectiveAction);

    const checkedFromSignal = getParamSignalValue();
    const checked = error || aborted ? initialChecked : checkedFromSignal;

    let inputCheckbox = (
      <input
        {...rest}
        ref={innerRef}
        type="checkbox"
        id={id}
        name={name}
        data-validation-message-arrow-x="center"
        checked={checked}
        disabled={disabled || pending}
        onInput={(e) => {
          const checkboxIsChecked = e.target.checked;
          if (checkedAtStart) {
            setNavStateValue(checkboxIsChecked ? false : undefined);
          } else {
            setNavStateValue(checkboxIsChecked ? true : undefined);
          }
          setParamSignalValue(checkboxIsChecked);
          if (onInput) {
            onInput(e);
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        oncancel={(e) => {
          e.target.checked = checked;
          setNavStateValue(checkedAtStart);
          if (onCancel) {
            onCancel();
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={onActionStart}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={onActionError}
        // eslint-disable-next-line react/no-unknown-property
        onactionend={() => {
          setNavStateValue(undefined);
          if (onActionEnd) {
            onActionEnd();
          }
        }}
      />
    );

    if (pendingEffect === "loading" && pendingTarget === "input") {
      inputCheckbox = (
        <LoaderBackground pending={pending}>{inputCheckbox}</LoaderBackground>
      );
    }

    let inputCheckboxWithLabel = label ? (
      <label data-disabled={disabled || pending ? "" : undefined}>
        {label}
        {inputCheckbox}
      </label>
    ) : (
      inputCheckbox
    );

    if (pendingEffect === "loading" && pendingTarget === "label") {
      inputCheckboxWithLabel = (
        <LoaderBackground pending={pending}>
          {inputCheckboxWithLabel}
        </LoaderBackground>
      );
    }

    return inputCheckboxWithLabel;
  },
);

const SimpleInputCheckbox = forwardRef((props, ref) => {});
