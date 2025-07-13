export const mergeTwoJsValues = (firstValue, secondValue) => {
  const firstIsPrimitive =
    firstValue === null || typeof firstValue !== "object";

  if (firstIsPrimitive) {
    return secondValue;
  }
  const secondIsPrimitive =
    secondValue === null || typeof secondValue !== "object";
  if (secondIsPrimitive) {
    return secondValue;
  }
  const objectMerge = {};
  const firstKeys = Object.keys(firstValue);
  const secondKeys = Object.keys(secondValue);
  let hasChanged = false;

  // First loop: check for keys in first object and recursively merge with second
  for (const key of firstKeys) {
    const firstValueForKey = firstValue[key];
    const secondHasKey = secondKeys.includes(key);

    if (secondHasKey) {
      const secondValueForKey = secondValue[key];
      const mergedValue = mergeTwoJsValues(firstValueForKey, secondValueForKey);
      objectMerge[key] = mergedValue;
      if (mergedValue !== firstValueForKey) {
        hasChanged = true;
      }
    } else {
      objectMerge[key] = firstValueForKey;
    }
  }

  for (const key of secondKeys) {
    if (firstKeys.includes(key)) {
      continue;
    }
    objectMerge[key] = secondValue[key];
    hasChanged = true;
  }

  if (!hasChanged) {
    return firstValue;
  }
  return objectMerge;
};
