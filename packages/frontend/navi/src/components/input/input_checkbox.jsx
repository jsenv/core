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
    const checkedAtStart =
      navStateValue === undefined ? initialChecked : navStateValue;
    const checkedSignal = useSignal(checkedAtStart);
    useOnFormReset(innerRef, () => {
      setNavStateValue(undefined);
    });
    const { pending } = useActionOrFormAction(innerRef, action, checkedSignal);
    const checkedRef = useRef(checkedAtStart);
    const checked = checkedRef.current;

    if (!pending) {
      checkedRef.current = checkedAtStart;
    }

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
        onInput={(e) => {
          const checked = e.target.checked;
          if (checkedAtStart) {
            setNavStateValue(checked ? false : undefined);
          } else {
            setNavStateValue(checked ? true : undefined);
          }
          checkedRef.current = checked;
          checkedSignal.value = checked;
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
        onactionerror={() => {
          if (onActionError) {
            onActionError();
          }
        }}
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
