import { useConstraints } from "@jsenv/validation";
import { useSignal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { LoaderBackground } from "../loader/loader_background.jsx";
import { useActionOrFormAction } from "../use_action_or_form_action.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useNavState } from "../use_nav_state.js";
import { useOnFormReset } from "../use_on_form_reset.js";

export const InputCheckbox = forwardRef(
  (
    {
      id,
      autoFocus,
      checked: initialChecked = false,
      constraints = [],
      requestExecuteOnChange,
      action,
      label,
      disabled,
      pendingEffect = "loading",
      onCancel,
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
    const checkedAtStart =
      navStateValue === undefined ? initialChecked : navStateValue;
    const checked = checkedAtStart;
    const checkedSignal = useSignal(checkedAtStart);
    useOnFormReset(innerRef, () => {
      setNavStateValue(undefined);
    });
    const { pending } = useActionOrFormAction(innerRef, action, checkedSignal);

    const inputCheckbox = (
      <input
        {...rest}
        ref={innerRef}
        type="checkbox"
        id={id}
        data-request-execute-on-change={requestExecuteOnChange ? "" : undefined}
        data-validation-message-arrow-x="center"
        checked={checked}
        disabled={disabled || pending}
        onChange={(e) => {
          if (checkedAtStart) {
            setNavStateValue(e.target.checked ? false : undefined);
          } else {
            setNavStateValue(e.target.checked ? true : undefined);
          }
        }}
        // eslint-disable-next-line react/no-unknown-property
        oncancel={() => {
          innerRef.current.checked = checked;
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

    const inputCheckboxWithLabel = label ? (
      <label>
        {label}
        {inputCheckbox}
      </label>
    ) : (
      inputCheckbox
    );

    if (pendingEffect === "loading") {
      return (
        <LoaderBackground pending={pending}>
          {inputCheckboxWithLabel}
        </LoaderBackground>
      );
    }
    return inputCheckboxWithLabel;
  },
);
