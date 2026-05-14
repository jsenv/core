import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const PickerContext = createContext();
export const PickerElementContext = createContext(null);
export const PickerRequestCloseContext = createContext(); // available only for picker children (popover and dialog)

const usePickerSetValue = () => {
  const pickerRef = useContext(PickerElementContext);
  return (value) => {
    const pickerEl = pickerRef.current;
    if (!pickerEl) {
      return;
    }
    pickerRef.current.dispatchEvent(
      new CustomEvent("navi_picker_set_value", {
        detail: { value },
        bubbles: true,
      }),
    );
  };
};

export const usePicker = () => {
  const setValue = usePickerSetValue();
  const requestClose = useContext(PickerRequestCloseContext);
  return {
    setValue,
    requestClose,
  };
};
