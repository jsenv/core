import { useMemo } from "preact/hooks";

import { ParentUIStateControllerContext } from "../ui_state_controller.js";
import { dispatchRequestSetUIState } from "../ui_state_dom.js";

/**
 * Wraps the picker's content area and automatically propagates any child
 * control's UI state changes to the picker input.
 *
 * This removes the need to put command="--navi-update" on controls inside
 * the picker — the sync is established implicitly by being inside the picker.
 *
 * Works for any first-level child control: a simple Input, a ControlGroup
 * (which abstracts its children into a single aggregated value), etc.
 *
 * The proxy is a minimal ParentUIStateControllerContext that only needs to
 * satisfy the interface expected by useParentControllerNotifiers:
 *   - controlType  (for debug logging)
 *   - registerChild / unregisterChild  (bookkeeping — not needed here)
 *   - onChildInteraction  (called when a child's UI state changes)
 */
export const PickerContentProxy = ({ children, pickerRef }) => {
  const proxyController = useMemo(
    () => ({
      controlType: "picker_content_proxy",
      registerChild: () => {},
      unregisterChild: () => {},
      onChildInteraction: (childController, e, { stateChanged }) => {
        if (!stateChanged) {
          return;
        }
        const pickerEl = pickerRef.current;
        if (!pickerEl) {
          return;
        }
        const pickerInput = pickerEl.querySelector(".navi_picker_input");
        if (!pickerInput) {
          return;
        }
        dispatchRequestSetUIState(pickerInput, childController.uiState, {
          event: e,
        });
      },
    }),
    [],
  );

  return (
    <ParentUIStateControllerContext.Provider value={proxyController}>
      {children}
    </ParentUIStateControllerContext.Provider>
  );
};
