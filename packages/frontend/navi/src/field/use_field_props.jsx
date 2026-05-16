import { useContext } from "preact/hooks";

import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { useDebugUIAction } from "../navi_debug.jsx";
import {
  reportDisabledToField,
  reportInteractiveToField,
  reportReadOnlyToField,
} from "./field.jsx";
import { ActionRequesterContext } from "./use_action_props.jsx";
import {
  DisabledContext,
  LoadingContext,
  ReadOnlyContext,
  UIStateControllerContext,
  useUIState,
} from "./use_ui_state_controller.js";
import { onRequestUIAction } from "./validation/custom_constraint_validation.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

export const useFieldProps = (props) => {
  const {
    ref,
    loading,
    readOnly,
    disabled,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    basePseudoState,
    ...rest
  } = props;
  const debugUIAction = useDebugUIAction();
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const actionRequester = useContext(ActionRequesterContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useUIState(uiStateController);

  const value = uiState;
  const innerLoading =
    loading || (contextLoading && actionRequester === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <Field> parent of our readOnly state + that we are interactive
  reportReadOnlyToField(innerReadOnly);
  reportDisabledToField(innerDisabled);
  reportInteractiveToField(true);
  useAutoFocus(ref, autoFocus, {
    focusVisible: autoFocusVisible,
    autoSelect,
  });
  const remainingProps = useConstraints(ref, rest);

  return {
    ...remainingProps,
    ref,
    value,
    "onnavi_request_reset_ui_state": (e) => {
      uiStateController.resetUIState(e);
    },
    "onnavi_set_ui_state": (e) => {
      const { value } = e.detail;
      uiStateController.setUIState(value, e);
    },
    "onnavi_request_ui_action": (e) => {
      const uiAction = e.detail.uiAction;
      if (uiAction === "not_available") {
        // we can't execute uiAction right now as value is not available
        // we just want to check if action is allowed to preventDefault or give feedback
        // but the value will be set later (checkbox click vs input use case)
        e.detail.uiAction = () => {};
      } else {
        e.detail.uiAction = (value, e) => {
          uiStateController.setUIState(value, e);
          uiAction?.(value, e);
        };
      }
      onRequestUIAction(e, {
        debugUIAction,
      });
    },
    "autoFocus": undefined, // See use_auto_focus.js
    "basePseudoState": {
      ...basePseudoState,
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading,
    },
    "aria-busy": innerLoading,
  };
};
