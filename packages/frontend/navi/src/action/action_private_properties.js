const actionPrivatePropertiesWeakMap = new WeakMap();
export const getActionPrivateProperties = (action) => {
  const actionPrivateProperties = actionPrivatePropertiesWeakMap.get(action);
  if (!actionPrivateProperties) {
    throw new Error(`Cannot find action private properties for "${action}"`);
  }
  return actionPrivateProperties;
};
export const setActionPrivateProperties = (action, properties) => {
  actionPrivatePropertiesWeakMap.set(action, properties);
};
