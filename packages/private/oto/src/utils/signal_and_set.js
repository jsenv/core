export const addToSetSignal = (setSignal, value) => {
  const set = setSignal.value;
  if (set.has(value)) {
    return false;
  }
  const setWithValue = new Set(set);
  setWithValue.add(value);
  setSignal.value = setWithValue;
  return true;
};

export const deleteFromSetSignal = (setSignal, value) => {
  const set = setSignal.value;
  if (!set.has(value)) {
    return false;
  }
  const setWithoutValue = new Set(set);
  setWithoutValue.delete(value);
  setSignal.value = setWithoutValue;
  return true;
};
