import { useControlProps } from "../control_hooks.jsx";

export const useCheckableProps = (props, { multiple }) => {
  const { ref } = props;
  const result = useControlProps(props, {
    primaryInteractionMode: "pointer",
    controlType: multiple ? "checkbox" : "radio",
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    getUIValue: () => {
      const el = ref.current;
      const checked = el.checked;
      return checked ? props.value : undefined;
    },
    fallbackState: false,
    getStateFromProp: (checked) => (checked ? props.value : undefined),
    getPropFromState: Boolean,
  });
  return result;
};
