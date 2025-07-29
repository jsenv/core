export const addIntoArray = (array, ...valuesToAdd) => {
  if (valuesToAdd.length === 1) {
    const [valueToAdd] = valuesToAdd;
    const arrayWithThisValue = [];
    for (const value of array) {
      if (value === valueToAdd) {
        return array;
      }
      arrayWithThisValue.push(value);
    }
    arrayWithThisValue.push(valueToAdd);
    return arrayWithThisValue;
  }

  const existingValueSet = new Set();
  const arrayWithTheseValues = [];
  for (const existingValue of array) {
    arrayWithTheseValues.push(existingValue);
    existingValueSet.add(existingValue);
  }
  let hasNewValues = false;
  for (const valueToAdd of valuesToAdd) {
    if (existingValueSet.has(valueToAdd)) {
      continue;
    }
    arrayWithTheseValues.push(valueToAdd);
    hasNewValues = true;
  }
  return hasNewValues ? arrayWithTheseValues : array;
};

export const removeFromArray = (array, ...valuesToRemove) => {
  if (valuesToRemove.length === 1) {
    const [valueToRemove] = valuesToRemove;
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
  }

  const valuesToRemoveSet = new Set(valuesToRemove);
  const arrayWithoutTheseValues = [];
  let hasRemovedValues = false;
  for (const value of array) {
    if (valuesToRemoveSet.has(value)) {
      hasRemovedValues = true;
      continue;
    }
    arrayWithoutTheseValues.push(value);
  }
  return hasRemovedValues ? arrayWithoutTheseValues : array;
};
