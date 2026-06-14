import { useControlProps } from "../control_hooks.jsx";

export const useCheckableProps = (props, options) => {
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
