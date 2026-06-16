import { isSignal } from "../../utils/is_signal.js";
import { useControlProps } from "../control_hooks.jsx";

export const useCheckableProps = (props, options) => {
  // If `checked` is a stateSignal, derive defaultChecked from the signal's
  // default value so resetUIState restores to the original default.
  const checkedProp = props.checked;
  if (
    isSignal(checkedProp) &&
    checkedProp.options &&
    !Object.hasOwn(props, "defaultChecked")
  ) {
    const defaultVal = checkedProp.options.getDefaultValue(false);
    if (defaultVal !== undefined) {
      const itemValue = props.value;
      if (Array.isArray(defaultVal)) {
        // Checkbox group: default is an array of selected values
        props.defaultChecked = defaultVal.includes(itemValue);
      } else if (itemValue !== undefined) {
        // Radio: default is the selected scalar value
        props.defaultChecked = defaultVal === itemValue;
      } else {
        // Simple boolean checkbox
        props.defaultChecked = Boolean(defaultVal);
      }
    }
  }
  const result = useControlProps(props, {
    controlType: "input",
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? props.value : undefined),
    getPropFromState: Boolean,
    ...options,
  });
  result[0].onnavi_get_value = (e) => {
    e.detail.respondWith(props.value);
  };
  return result;
};
