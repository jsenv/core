import { useFieldInterfaceProps } from "../field_hooks.jsx";

export const useTextualFieldInterfaceProps = (
  props,
  { fieldType = "input" } = {},
) => {
  const result = useFieldInterfaceProps(props, {
    fieldType,
    statePropName: "value",
    defaultStatePropName: "defaultValue",
    readOnlySupported: true,
  });
  return result;
};
