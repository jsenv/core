import { useConstraints } from "@jsenv/form";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../actions.js";
import { useFormActionRef, useFormStatus } from "../form/use_form_status.js";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useRequestSubmitOnChange } from "../user_request_submit_on_change.js";

export const InputText = forwardRef(
  (
    {
      id,
      autoFocus,
      autoSelect,
      required,
      action,
      name,
      label,
      defaultValue = "",
      value,
      constraints = [],
      cancelOnBlurInvalid,
      formMethod,
      form = Boolean(formMethod),
      formPendingEffect = "loading",
      requestSubmitOnChange = form,
      oncancel,
      disabled,
      onInput,
      ...rest
    },
    ref,
  ) => {
    const formStatus = useFormStatus();
    const formActionRef = useFormActionRef();
    if (!action) {
      action = formStatus.action;
    }
    const { pending } = useActionStatus(action);
    if (import.meta.dev && !name && formStatus.method) {
      console.warn(
        "InputText: name is required for the input to work property with <form> submission.",
      );
    }

    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
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
        disabled={disabled || pending}
        required={required}
        onInput={(e) => {
          setNavStateValue(e.target.value);
          onInput?.(e);
        }}
        // eslint-disable-next-line react/no-unknown-property
        onrequestsubmit={() => {
          formActionRef.current = action;
        }}
        // eslint-disable-next-line react/no-unknown-property
        oncancel={(event) => {
          if (event.detail === "blur_invalid" && !cancelOnBlurInvalid) {
            return;
          }
          innerRef.current.value =
            value === undefined || value === "" ? "" : value;
          if (oncancel) {
            oncancel(event);
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={() => {
          setNavStateValue(undefined);
        }}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={(e) => {
          setNavStateValue(e.target.value);
        }}
      />
    );

    const inputWithLabel = label ? (
      <label>
        {label}
        {input}
      </label>
    ) : (
      input
    );

    if (formPendingEffect === "loading") {
      return (
        <LoaderBackground pending={pending}>{inputWithLabel}</LoaderBackground>
      );
    }
    return inputWithLabel;
  },
);
