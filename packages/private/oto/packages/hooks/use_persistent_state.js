import { useEffect, useState } from "preact/hooks";

export const usePersistentState = (id, initialValue) => {
  const get = () => {
    const item = localStorage.getItem(id);
    return item ? JSON.parse(item) : initialValue;
  };
  const fromStorage = (initialValue = get());
  if (fromStorage !== undefined) {
    initialValue = fromStorage;
  }
  const [value, valueSetter] = useState(initialValue);
  const set = (value) => {
    localStorage.setItem(id, JSON.stringify(value));
    valueSetter(value);
  };
  return [value, set];
};

export const usePersistentMultiState = (id, initialValue) => {
  const get = () => {
    const item = localStorage.getItem(id);
    return item ? JSON.parse(item) : initialValue;
  };
  const fromStorage = (initialValue = get());
  if (fromStorage !== undefined) {
    initialValue = fromStorage;
  }
  const useStateHooks = {};
  const values = [];
  for (const key of Object.keys(initialValue)) {
    const [value, valueSetter] = useState(initialValue[key]);
    values.push(value);
    useStateHooks[key] = [value, valueSetter];
  }
  useEffect(() => {
    const value = {};
    for (const key of Object.keys(initialValue)) {
      value[key] = values;
    }
    localStorage.setItem(id, JSON.stringify(value));
  }, values);

  return useStateHooks;
};
