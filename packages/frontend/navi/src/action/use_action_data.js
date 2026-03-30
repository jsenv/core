export const useActionData = (action) => {
  if (!action) {
    return undefined;
  }
  const data = action.dataSignal.value;
  return data;
};
