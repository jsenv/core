import { useContext } from "preact/hooks";

import { FieldContext } from "./field.jsx";
import {
  DisabledContext,
  FieldNameContext,
  LoadingContext,
  ParentUIStateControllerContext,
  ReadOnlyContext,
  RequiredContext,
  UIStateControllerContext,
} from "./use_ui_state_controller.js";

export const useFieldGroupProps = (props) => {
  const {
    name,
    loading,
    disabled,
    readOnly,
    children,
    required,
    ...remainingProps
  } = props;
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);

  const innerLoading = loading || contextLoading;
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;

  const childrenWithContext =
    children === undefined ? (
      children
    ) : (
      <ParentUIStateControllerContext.Provider value={uiStateController}>
        <FieldNameContext.Provider value={name}>
          <ReadOnlyContext.Provider value={innerReadOnly}>
            <DisabledContext.Provider value={innerDisabled}>
              <RequiredContext.Provider value={required}>
                <LoadingContext.Provider value={innerLoading}>
                  <FieldContext.Provider value={null}>
                    {children}
                  </FieldContext.Provider>
                </LoadingContext.Provider>
              </RequiredContext.Provider>
            </DisabledContext.Provider>
          </ReadOnlyContext.Provider>
        </FieldNameContext.Provider>
      </ParentUIStateControllerContext.Provider>
    );

  return {
    ...remainingProps,
    onnavi_request_reset_ui_state: (e) => {
      uiStateController.resetUIState(e);
    },
    children: childrenWithContext,
  };
};
