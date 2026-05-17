import { useState } from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { useDebugAction } from "../navi_debug.jsx";
import {
  ActionContext,
  ActionRequesterContext,
  DisabledContext,
  FieldNameContext,
  LoadingContext,
  ReadOnlyContext,
  RequiredContext,
} from "./field_context.js";
import { useActionProps } from "./use_field_props.jsx";
import {
  ParentUIStateControllerContext,
  useUIGroupStateController,
} from "./use_ui_state_controller.js";

export const useFieldGroupProps = (
  props,
  { fieldType, childComponentType, aggregateChildStates },
) => {
  const { action, name, children, required } = props;
  const debugAction = useDebugAction();
  const uiGroupStateController = useUIGroupStateController(props, fieldType, {
    childComponentType,
    aggregateChildStates,
    debugAction,
  });
  // const uiState = useUIState(uiGroupStateController);
  const [boundAction] = useActionBoundToOneParam(
    action,
    uiGroupStateController.uiStateSignal,
  );

  let childrenWithContext;
  if (children === undefined) {
    childrenWithContext = undefined;
  } else {
    childrenWithContext = (
      <ActionContext.Provider value={boundAction}>
        <ParentUIStateControllerContext.Provider value={uiGroupStateController}>
          <FieldNameContext.Provider value={name}>
            <RequiredContext.Provider value={required}>
              {children}
            </RequiredContext.Provider>
          </FieldNameContext.Provider>
        </ParentUIStateControllerContext.Provider>
      </ActionContext.Provider>
    );
  }

  const [actionRequester, setActionRequester] = useState();
  const actionProps = useActionProps(
    {
      ...props,
      children: childrenWithContext,
    },
    {
      action: boundAction,
      uiStateController: uiGroupStateController,
      readUIState: () => {
        return uiGroupStateController.uiStateSignal.peek();
      },
    },
  );

  if (actionProps.children === undefined) {
    childrenWithContext = undefined;
  } else {
    const { basePseudoState } = actionProps;
    const disabled = basePseudoState[":disabled"];
    const readOnly = basePseudoState[":read-only"];
    const loading = basePseudoState[":-navi-loading"];

    console.log("field group props", {
      disabled,
      readOnly,
      loading,
    });

    childrenWithContext = (
      <ActionRequesterContext.Provider value={actionRequester}>
        <ReadOnlyContext.Provider value={readOnly}>
          <DisabledContext.Provider value={disabled}>
            <LoadingContext.Provider value={loading}>
              {actionProps.children}
            </LoadingContext.Provider>
          </DisabledContext.Provider>
        </ReadOnlyContext.Provider>
      </ActionRequesterContext.Provider>
    );
  }

  return {
    children: childrenWithContext,
    ...actionProps,
    value: undefined, // field group doesn't have a value
    onnavi_action_ready: (e) => {
      setActionRequester(e.detail.requester);
      actionProps.onnavi_action_ready(e);
    },
  };
};
