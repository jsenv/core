import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useAction } from "../use_action.js";
import { useActionParamsSignal } from "../use_action_params_signal.js";
import { useExecuteAction } from "../use_execute_action.js";
import { ActionContext } from "./action_context.js";

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

    const paramsSignal = useActionParamsSignal({});

    action = useAction(action, paramsSignal);
    const executeAction = useExecuteAction(innerRef, { errorEffect });

    return (
      <fieldset
        {...rest}
        ref={innerRef}
        // eslint-disable-next-line react/no-unknown-property
        onexecute={async (executeEvent) => {
          const fieldset = executeEvent.target;
          // do the form data stuff
          const params = {};
          for (const [name, value] of fieldset.elements) {
            if (name in params) {
              if (Array.isArray(params[name])) {
                params[name].push(value);
              } else {
                params[name] = [params[name], value];
              }
            } else {
              params[name] = value;
            }
          }
          paramsSignal.value = params;

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
