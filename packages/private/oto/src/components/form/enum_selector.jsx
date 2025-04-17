import { usePersistentState } from "hooks/use_persistent_state.js";
import { useLayoutEffect } from "preact/hooks";

export const EnumSelector = ({ name, values, onChange, ...props }) => {
  const [selectedValue, selectedValueSetter] = usePersistentState(
    name,
    values[0],
  );
  useLayoutEffect(() => {
    onChange(selectedValue);
  }, [selectedValue]);

  return (
    <fieldset {...props}>
      <legend>{name}</legend>
      {values.map((value, index) => {
        return (
          <label key={index}>
            <input
              type="radio"
              name={name}
              checked={selectedValue === value}
              onInput={(e) => {
                if (e.target.checked) {
                  selectedValueSetter(value);
                }
              }}
            />
            {value}
          </label>
        );
      })}
    </fieldset>
  );
};
