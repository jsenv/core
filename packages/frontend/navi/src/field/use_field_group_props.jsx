import { useState } from "preact/hooks";

import { useActionBoundToOneParam } from "@jsenv/navi/src/action/use_action.js";
import { ActionContext, ActionRequesterContext } from "./field_context.js";
import { useActionProps } from "./use_field_props.jsx";
import {
  DisabledContext,
  FieldNameContext,
  LoadingContext,
  ParentUIStateControllerContext,
  ReadOnlyContext,
  RequiredContext,
  useUIGroupStateController,
  useUIState,
} from "./use_ui_state_controller.js";

export const useFieldGroupProps = (
  props,
  { fieldType, childComponentType, aggregateChildStates },
) => {
  const { action, name, children, required } = props;
  const uiGroupStateController = useUIGroupStateController(fieldType, {
    childComponentType,
    aggregateChildStates,
  });
  const uiState = useUIState(uiGroupStateController);
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
      uiStateController: uiGroupStateController,
    },
  );

  if (actionProps.children === undefined) {
    childrenWithContext = undefined;
  } else {
    const { basePseudoState } = actionProps;
    const disabled = basePseudoState[":disabled"];
    const readOnly = basePseudoState[":read-only"];
    const loading = basePseudoState[":-navi-loading"];

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
    value: uiState,
    onnavi_action_ready: (e) => {
      setActionRequester(e.detail.requester);
      actionProps.onnavi_action_ready(e);
    },
  };
};
