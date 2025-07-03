import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { ActionContext } from "./action_execution/action_context.js";
import { useAction } from "./action_execution/use_action.js";
import { useExecuteAction } from "./action_execution/use_execute_action.js";
import { useFormDataParamsSignal } from "./action_execution/use_form_data_params_signal.js";

export const Fieldset = forwardRef(
  (
    {
      action,
      children,
      errorEffect = "show_validation_message", // "show_validation_message" or "throw",
      onExecutePrevented,
      onExecute,
      onActionStart,
      onActionError,
      onActionEnd,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    const [paramsSignal, setParamsSignalValue] = useFormDataParamsSignal();

    action = useAction(action, paramsSignal);
    const executeAction = useExecuteAction(innerRef, { errorEffect });

    return (
      <fieldset
        {...rest}
        ref={innerRef}
        // eslint-disable-next-line react/no-unknown-property
        onexecute={async (executeEvent) => {
          const fieldset = executeEvent.target;
          const formData = createFieldsetFormData(fieldset);
          setParamsSignalValue(formData);
          if (onExecute) {
            onExecute();
          }
          await executeAction(action, {
            requester: executeEvent.detail.requester,
          });
        }}
        // eslint-disable-next-line react/no-unknown-property
        onexecuteprevented={onExecutePrevented}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={onActionStart}
        // eslint-disable-next-line react/no-unknown-property
        onactionend={onActionEnd}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={onActionError}
      >
        <ActionContext.Provider value={action}>
          {children}
        </ActionContext.Provider>
      </fieldset>
    );
  },
);

const createFieldsetFormData = (fieldset) => {
  const formData = new FormData();

  const formElements = fieldset.querySelectorAll(
    "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[name]:not([disabled])",
  );

  for (const element of formElements) {
    const name = element.name;
    if (!name) continue;

    const value = getElementValue(element);
    if (value === undefined) continue; // Skip unchecked checkboxes/radios

    // Handle multiple values and files
    if (element.type === "file" && element.files) {
      // Add all files for file inputs
      for (const file of element.files) {
        formData.append(name, file);
      }
    } else if (Array.isArray(value)) {
      // Handle select multiple
      value.forEach((v) => formData.append(name, v));
    } else {
      // Regular values
      formData.append(name, value);
    }
  }

  return formData;
};

const getElementValue = (element) => {
  const { type, tagName } = element;

  if (tagName === "SELECT") {
    if (element.multiple) {
      return Array.from(element.selectedOptions, (option) => option.value);
    }
    return element.value;
  }

  if (type === "checkbox" || type === "radio") {
    return element.checked ? element.value : undefined;
  }

  if (type === "file") {
    return element.files; // Return FileList for special handling
  }

  return element.value;
};
