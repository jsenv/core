import {
  ParentUIStateControllerContext,
  useUIFacadeStateController,
} from "../ui_state_controller.js";

export const PickerContentProxy = ({ children, pickerRef }) => {
  const facadeController = useUIFacadeStateController(() => {
    const pickerEl = pickerRef.current;
    if (!pickerEl) {
      return null;
    }
    return pickerEl.querySelector(".navi_picker_input");
  });

  return (
    <ParentUIStateControllerContext.Provider value={facadeController}>
      {children}
    </ParentUIStateControllerContext.Provider>
  );
};
