import { useCallback, useState } from "preact/hooks";

export const useBooleanState = (initialValue = false) => {
  const [value, valueSetter] = useState(initialValue);
  const setToTrue = useCallback(() => {
    valueSetter(true);
  }, []);
  const setToFalse = useCallback(() => {
    valueSetter(false);
  }, []);
  return [value, setToTrue, setToFalse];
};
