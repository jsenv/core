import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { ActionContext } from "./action_execution/action_context.js";
import { renderActionComponent } from "./action_execution/render_action_component.jsx";
import { useAction } from "./action_execution/use_action.js";
import { useExecuteAction } from "./action_execution/use_execute_action.js";
import { collectFormElementValues } from "./collect_form_element_values.js";

export const Fieldset = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, ActionFieldset, SimpleFieldset);
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

  const [boundAction, , setParams] = useAction(action);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });

  return (
    <fieldset
      {...rest}
      ref={innerRef}
      action={`javascript:void(${boundAction.name})`}
      // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={async (actionEvent) => {
        const fieldset = actionEvent.target;
        const params = collectFormElementValues(fieldset);
        setParams(params);

        const actionToExecute = actionEvent.detail.action || boundAction;
        executeAction(actionToExecute, {
          requester: actionEvent.detail.requester,
        });
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionstart={onActionStart}
      // eslint-disable-next-line react/no-unknown-property
      onactionerror={onActionError}
      // eslint-disable-next-line react/no-unknown-property
      onactionend={onActionEnd}
    >
      <ActionContext.Provider value={[boundAction]}>
        {children}
      </ActionContext.Provider>
    </fieldset>
  );
});
