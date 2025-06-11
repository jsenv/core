import { useConstraints } from "@jsenv/form";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../action/action_hooks.js";
import { useAutoFocus } from "../hooks/use_auto_focus.js";
import { useNavState } from "../hooks/use_nav_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";

export const InputText = forwardRef(
  (
    {
      id,
      autoFocus,
      autoSelect,
      required,
      action,
      name,
      defaultValue = "",
      value,
      constraints = [],
      requestSubmitOnChange,
      cancelOnBlurInvalid,
      formPendingEffect,
      onCancel,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    const { pending } = useActionStatus(action);
    useAutoFocus(innerRef, autoFocus, autoSelect);
    useRequestSubmitOnChange(innerRef, {
      requestSubmitOnChange,
      preventWhenValueMissing: true,
    });
    useConstraints(innerRef, constraints);

    const [navStateValue, setNavStateValue] = useNavState(id);
    defaultValue = defaultValue || navStateValue;

    const input = (
      <input
        {...rest}
        ref={innerRef}
        type="text"
        name={name}
        value={value === undefined ? defaultValue : value}
        disabled={pending}
        required={required}
        // eslint-disable-next-line react/no-unknown-property
        onCancel={(event) => {
          if (event.detail === "blur_invalid" && !cancelOnBlurInvalid) {
            return;
          }
          innerRef.current.value =
            value === undefined || value === "" ? "" : value;
          if (onCancel) {
            onCancel(event.detail);
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        onSubmitStart={() => {
          setNavStateValue(undefined);
        }}
        // eslint-disable-next-line react/no-unknown-property
        onSubmitError={() => {
          setNavStateValue(innerRef.current.value);
        }}
      />
    );
    if (formPendingEffect === "loading") {
      return <LoaderBackground pending={pending}>{input}</LoaderBackground>;
    }
    return input;
  },
);
