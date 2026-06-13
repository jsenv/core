import { dispatchRequestInteraction } from "@jsenv/navi/src/control/validation/custom_constraint_validation.js";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";

const getPickerInput = (pickerButton) => {
  const pickerInput = pickerButton.querySelector(".navi_picker_input");
  return pickerInput;
};

export const PickerNative = (props) => {
  const Next = useNextResolver();
  const { onClick } = props;

  const onRequestOpen = (e) => {
    const pickerButton = e.currentTarget;
    const pickerInput = getPickerInput(pickerButton);
    if (!pickerInput) {
      return;
    }
    const allowed = dispatchRequestInteraction(
      pickerInput,
      e,
      e.type === "click" ? "click to show picker" : "navi_request_open event",
    );
    if (allowed) {
      try {
        pickerInput.showPicker();
      } catch {
        pickerInput.click();
      }
    }
  };

  return (
    <Next
      {...props}
      // Only wait for the native "change" event (dialog close) when the picker has its own
      // action. Without an action, the change event would trigger a noop action cycle and
      // cause spurious state updates (e.g. when closing the color dialog on form submit).
      actionInteraction={props.action ? "change" : undefined}
      onnavi_request_open={(e) => {
        onRequestOpen(e);
      }}
      onClick={(e) => {
        onClick?.(e);
        onRequestOpen(e);
      }}
    />
  );
};
