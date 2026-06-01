import { useControlProps } from "../control_hooks.jsx";

export const useCheckableProps = (props, { multiple }) => {
  const result = useControlProps(props, {
    primaryInteractionMode: "pointer",
    controlType: multiple ? "checkbox" : "radio",
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? props.value : undefined),
    getPropFromState: Boolean,
  });
  return result;
};
