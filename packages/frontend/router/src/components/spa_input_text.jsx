import {
  useInputCustomValidationRef,
  useInputValidationMessage,
} from "@jsenv/form";
import { forwardRef } from "preact/compat";
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";
import { useActionStatus } from "../action/action_hooks.js";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { SPAForm } from "./spa_form.jsx";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";

export const SPAInputText = forwardRef(
  (
    {
      action,
      onSubmitStart,
      onSubmitEnd,
      onSubmitError,
      method = "PUT",
      label,
      defaultValue,
      name,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => {
      const input = innerRef.current;
      return input;
    });
    const [addFormErrorOnInput, removeFormErrorFromInput] =
      useInputValidationMessage(innerRef, "form_error");

    const [navStateValue, setNavStateValue] = useNavigationState(name);

    const input = (
      <InputText
        ref={innerRef}
        action={action}
        name={name}
        defaultValue={defaultValue || navStateValue}
        {...rest}
      />
    );

    return (
      <SPAForm
        action={action}
        method={method}
        onSubmitStart={() => {
          removeFormErrorFromInput();
          if (onSubmitStart) {
            onSubmitStart();
          }
        }}
        onSubmitError={(e) => {
          setNavStateValue(innerRef.current.value);
          addFormErrorOnInput(e);
          if (onSubmitError) {
            onSubmitError(e);
          }
        }}
        onSubmitEnd={() => {
          setNavStateValue(undefined);
          onSubmitEnd();
        }}
      >
        {label ? (
          <label>
            {label}
            {input}
          </label>
        ) : (
          input
        )}
      </SPAForm>
    );
  },
);

const none = {};
const useNavigationState = (name) => {
  const navStateRef = useRef(none);
  if (navStateRef.current === none) {
    const navEntryState = navigation.currentEntry.getState();
    navStateRef.current =
      navEntryState && name ? navEntryState[name] : undefined;
  }
  return [
    navStateRef.current,
    (value) => {
      navStateRef.current = value;
      if (!name) {
        return;
      }
      const currentState = navigation.currentEntry.getState() || {};
      if (value === undefined) {
        delete currentState[name];
      } else {
        currentState[name] = value;
      }
      navigation.updateCurrentEntry({
        state: currentState,
      });
    },
  ];
};

const InputText = forwardRef(
  (
    {
      autoFocus,
      autoSelect,
      required,
      action,
      name,
      defaultValue = "",
      value,
      constraints = [],
      cancelOnBlurInvalid,
      onCancel,
      onInput,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => {
      const input = innerRef.current;
      return input;
    });
    const { pending } = useActionStatus(action);
    const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
      value === undefined ? defaultValue : value,
      name,
    );
    useRequestSubmitOnChange(innerRef, { preventWhenValueMissing: true });

    // autoFocus does not work so we focus in a useLayoutEffect,
    // see https://github.com/preactjs/preact/issues/1255
    useLayoutEffect(() => {
      if (autoFocus) {
        const input = innerRef.current;
        input.focus();
        if (autoSelect) {
          input.select();
        }
      }
    }, [autoFocus]);

    useEffect(() => {
      if (autoFocus) {
        const input = innerRef.current;
        input.scrollIntoView({ inline: "nearest", block: "nearest" });
      }
    }, []);

    const inputCustomValidationRef = useInputCustomValidationRef(innerRef);
    useLayoutEffect(() => {
      const inputCustomValidation = inputCustomValidationRef.current;
      const cleanupCallbackSet = new Set();
      for (const constraint of constraints) {
        const unregister = inputCustomValidation.registerConstraint(constraint);
        cleanupCallbackSet.add(unregister);
      }
      return () => {
        for (const cleanupCallback of cleanupCallbackSet) {
          cleanupCallback();
        }
      };
    }, constraints);

    return (
      <LoaderBackground pending={pending}>
        <input
          {...rest}
          ref={innerRef}
          type="text"
          name={name}
          value={optimisticUIState}
          disabled={pending}
          required={required}
          onInput={(e) => {
            const input = e.target;
            setOptimisticUIState(input.value);
            if (onInput) {
              onInput(e);
            }
          }}
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
        />
      </LoaderBackground>
    );
  },
);
