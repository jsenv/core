import { useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { useActionSingleParamSignal } from "../action_execution/use_action_params_signal.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
// import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

import.meta.css = /*css*/ `
  label[data-disabled] {
    opacity: 0.5;
  }
`;

export const InputRadio = forwardRef(
  (
    {
      id,
      name,
      value,
      autoFocus,
      checked: initialChecked = false,
      constraints = [],
      action,
      children,
      disabled,
      pendingEffect = "loading",
      pendingTarget = "input", // "input" or "label"
      onCancel,
      onChange,
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

    // const [navStateValue, setNavStateValue] = useNavState(id);
    const checkedAtStart = initialChecked; // || navStateValue === value;
    const [checkedSignal, getParamSignalValue, setParamSignalValue] =
      useActionSingleParamSignal(
        action,
        checkedAtStart ? value : undefined,
        name,
      );
    useOnFormReset(innerRef, () => {
      if (checkedAtStart) {
        // setNavStateValue(value);
      }
    });
    const { pending } = useActionOrParentActionStatus(
      innerRef,
      action,
      checkedSignal,
    );

    const valueChecked = getParamSignalValue();
    // le souci avec ça c'est que ca va changer la valeur de qui est check
    // (ca remet celle du haut)
    // qui du coup n'est pas en erreur
    // valueChecked vaut le 2eme radio
    // error vaut null jusqu'a ce quon re-render et la magiquement le second se check
    // alors qu'on voudrait le premier
    // en fait on voudrait le premier check mais l'action courante doit rester le second
    const checked = value === valueChecked;

    let inputRadio = (
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
            setParamSignalValue(value);
          }
          if (onChange) {
            onChange(e);
          }
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
        onactionstart={onActionStart}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={() => {
          if (initialChecked) {
            debugger;
            setParamSignalValue(value);
          }
          onActionError?.();
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionend={onActionEnd}
      />
    );

    if (pendingEffect === "loading" && pendingTarget === "input") {
      inputRadio = (
        <LoaderBackground pending={pending}>{inputRadio}</LoaderBackground>
      );
    }

    let inputRadioWithLabel = children ? (
      <label data-disabled={disabled || pending ? "" : undefined}>
        {inputRadio}
        {children}
      </label>
    ) : (
      inputRadio
    );

    if (pendingEffect === "loading" && pendingTarget === "label") {
      inputRadioWithLabel = (
        <LoaderBackground pending={pending}>
          {inputRadioWithLabel}
        </LoaderBackground>
      );
    }

    return inputRadioWithLabel;
  },
);
