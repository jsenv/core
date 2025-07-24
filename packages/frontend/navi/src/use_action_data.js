import { getActionPrivateProperties } from "./action_private_properties.js";

export const useActionData = (action) => {
  if (!action) {
    return undefined;
  }
  const { computedDataSignal } = getActionPrivateProperties(action);
  const data = computedDataSignal.value;
  return data;
};
