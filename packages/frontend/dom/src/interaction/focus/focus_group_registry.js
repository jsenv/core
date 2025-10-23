// WeakMap to store focus group metadata
export const focusGroupRegistry = new WeakMap();

export const setFocusGroup = (element, options) => {
  focusGroupRegistry.set(element, options);
  return () => {
    focusGroupRegistry.delete(element);
  };
};
export const getFocusGroup = (element) => {
  return focusGroupRegistry.get(element);
};
