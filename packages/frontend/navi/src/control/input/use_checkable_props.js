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
      if (props.type === "radio") {
        props.defaultChecked = defaultVal === itemValue;
      } else if (props.type === "checkbox") {
        props.defaultChecked =
          Array.isArray(defaultVal) && defaultVal.includes(itemValue);
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
