import { dispatchRequestInteraction } from "@jsenv/navi/src/field/validation/custom_constraint_validation.js";
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
