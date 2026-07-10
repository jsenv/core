import { useControlProps } from "../control_hooks.jsx";

export const useCheckableProps = (props, options) => {
  // Derives defaultChecked from a `checked` signal's default value, and
  // wires the signal's default uiAction — same normalization as text/number
  // inputs, applied here since checkables are controlled via `checked`.
  const result = useControlProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      ...props,
    },
    {
      controlType: "input",
      ...options,
    },
  );
  result[1].onnavi_get_value = (e) => {
    e.detail.respondWith(props.value);
  };
  return result;
};
