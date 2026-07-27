import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const PickerContext = createContext();

// The resolved popup mode of the surrounding Picker: "popover" or "dialog"
// (frozen for the lifetime of an opening — see usePopupMode). Provided around the
// picker's popup content so that content can render differently per mode.
export const PickerModeContext = createContext(undefined);

/**
 * Read the mode ("popover" | "dialog") of the Picker whose popup this is rendered
 * inside. Only meaningful for a Picker's popup content (its children); returns
 * undefined anywhere else.
 *
 * @returns {"popover" | "dialog" | undefined}
 */
export const usePickerMode = () => useContext(PickerModeContext);
