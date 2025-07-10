export const addIntoArray = (array, valueToAdd) => {
  const arrayWithThisValue = [];
  for (const value of array) {
    if (value === valueToAdd) {
      return array;
    }
    arrayWithThisValue.push(value);
  }
  arrayWithThisValue.push(valueToAdd);
  return arrayWithThisValue;
};

export const removeFromArray = (array, valueToRemove) => {
  const arrayWithoutThisValue = [];
  let found = false;
  for (const value of array) {
    if (value === valueToRemove) {
      found = true;
      continue;
    }
    arrayWithoutThisValue.push(value);
  }
  if (!found) {
    return array;
  }
  return arrayWithoutThisValue;
};
