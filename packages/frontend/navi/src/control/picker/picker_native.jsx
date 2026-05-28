import { dispatchRequestInteraction } from "@jsenv/navi/src/control/validation/custom_constraint_validation.js";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";

const getPickerInputFromButtonEvent = (e) => {
  const pickerButton = e.currentTarget;
  const pickerInput = getPickerInput(pickerButton);
  return pickerInput;
};
const getPickerInput = (pickerButton) => {
  const pickerInput = pickerButton.querySelector(".navi_picker_input");
  return pickerInput;
};

export const PickerNative = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      {...props}
      // Only wait for the native "change" event (dialog close) when the picker has its own
      // action. Without an action, the change event would trigger a noop action cycle and
      // cause spurious state updates (e.g. when closing the color dialog on form submit).
      actionInteraction={props.action ? "change" : undefined}
      onClick={(e) => {
        props.onClick?.(e);
        const pickerInput = getPickerInputFromButtonEvent(e);
        const allowed = dispatchRequestInteraction(
          pickerInput,
          e,
          "click_to_show_picker",
        );
        if (allowed) {
          try {
            pickerInput.showPicker();
          } catch {
            pickerInput.click();
          }
        }
      }}
    />
  );
};
