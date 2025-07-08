import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { ActionContext } from "./action_execution/action_context.js";
import { renderActionComponent } from "./action_execution/render_action_component.jsx";
import { useAction } from "./action_execution/use_action.js";
import { useExecuteAction } from "./action_execution/use_execute_action.js";
import { collectFormElementValues } from "./collect_form_element_values.js";
import { useActionEvents } from "./use_action_events.js";

export const Fieldset = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, SimpleFieldset, ActionFieldset);
});

const SimpleFieldset = forwardRef((props, ref) => {
  return <fieldset ref={ref} {...props} />;
});

const ActionFieldset = forwardRef((props, ref) => {
  const {
    action,
    children,
    actionErrorEffect = "show_validation_message", // "show_validation_message" or "throw",
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [boundAction, , setParams] = useAction(action, {
    formElementCollection: true,
  });
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      const fieldset = actionEvent.target;
      const params = collectFormElementValues(fieldset);
      setParams(params);

      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <SimpleFieldset
      {...rest}
      ref={innerRef}
      action={`javascript:void(\`${boundAction.name}\`)`}
    >
      <ActionContext.Provider value={[boundAction]}>
        {children}
      </ActionContext.Provider>
    </SimpleFieldset>
  );
});
