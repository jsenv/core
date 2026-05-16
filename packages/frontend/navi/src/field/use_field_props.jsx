import { useContext } from "preact/hooks";

import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
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
    value,
    "aria-busy": innerLoading,
    "onnavi_request_reset_ui_state": (e) => {
      uiStateController.resetUIState(e);
    },
    "onnavi_set_ui_state": (e) => {
      const { value } = e.detail;
      uiStateController.setUIState(value, e);
    },
    "onnavi_request_ui_action": (e) => {
      const uiAction = e.detail.uiAction;
      e.detail.uiAction = (value, e) => {
        uiStateController.setUIState(value, e);
        uiAction?.(value, e);
      };
      onRequestUIAction(e);
    },
    "autoFocus": undefined, // See use_auto_focus.js
    "basePseudoState": {
      ...basePseudoState,
      ":read-only": readOnly,
      ":disabled": disabled,
      ":-navi-loading": loading,
    },
  };
};
