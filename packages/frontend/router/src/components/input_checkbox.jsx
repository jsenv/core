import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../action/action_hooks.js";
import { useNavState } from "../hooks/use_nav_state.js";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useSPAFormStatus } from "./use_spa_form_status.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";

export const InputCheckbox = forwardRef(
  (
    {
      id,
      name,
      requestSubmitOnChange,
      checked = false,
      defaultChecked = false,
      action,
      disabled,
      formPendingEffect,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    const spaFormStatus = useSPAFormStatus();
    action = action || spaFormStatus.action;
    useRequestSubmitOnChange(innerRef, {
      requestSubmitOnChange,
      preventWhenValueMissing: true,
    });
    const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
      checked,
      name,
      { revertOnFailure: true },
    );
    const { pending } = useActionStatus(action);

    const [navStateValue, setNavStateValue] = useNavState(id);
    defaultChecked = defaultChecked || navStateValue;
    checked =
      optimisticUIState === undefined ? defaultChecked : optimisticUIState;
    disabled = disabled || pending;

    const inputCheckbox = (
      <input
        {...rest}
        ref={innerRef}
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onInput={(e) => {
          setOptimisticUIState(e.target.checked);
        }}
        data-validation-message-arrow-x="center"
        // eslint-disable-next-line react/no-unknown-property
        oncancel={() => {
          innerRef.current.checked = checked;
          setNavStateValue(checked);
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={() => {
          setNavStateValue(optimisticUIState);
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={() => {
          setNavStateValue(optimisticUIState);
        }}
      />
    );

    if (formPendingEffect === "loading") {
      return (
        <LoaderBackground pending={pending}>{inputCheckbox}</LoaderBackground>
      );
    }
    return inputCheckbox;
  },
);
