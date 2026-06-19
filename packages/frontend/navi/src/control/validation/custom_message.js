export const addCustomMessage = (element, key, message, options) => {
  const controller = element.__uiStateController__;
  if (!controller) {
    throw new Error("element has no __uiStateController__");
  }
  const controlValidity = controller.controlValidity;
  return controlValidity.addCustomMessage(key, message, options);
};

export const removeCustomMessage = (element, key) => {
  const controller = element.__uiStateController__;
  if (!controller) {
    throw new Error("element has no __uiStateController__");
  }
  const controlValidity = controller.controlValidity;
  return controlValidity.removeCustomMessage(key);
};
