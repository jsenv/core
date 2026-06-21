import { asControlHostValue } from "./control_value.js";

// In-memory registry of all mounted ui state controllers keyed by their id.
// Allows direct controller access without dispatching DOM events — used by external
// callers (e.g. selectable_list) to call setUIState by id instead of via the DOM.
const controllersById = new Map();

// In-memory registry for radio controllers, keyed by input name.
// Allows radio sibling unchecking without querying the DOM — necessary when
// items are virtualized and their DOM element may not exist at the time.
// Form scoping is reproduced by comparing parentUIStateController references.
const radioControllersByName = new Map();

// Registry for non-serializable JS values that cannot be written to DOM attributes as-is.
// When a value is an object/array, we store it here and write a reference string to the DOM
// instead of "[object Object]". Console-inspectable via window.__navi_js('id').
// The controller id is used as key — if the controller has no id, the value is not registered.
const naviJsRegistry = new Map();

export const getUIStateControllerById = (id) => controllersById.get(id);
export const getRadioSiblings = (radioUIStateController) => {
  const siblings = radioControllersByName.get(radioUIStateController.name);
  return siblings;
};
export const toDomValue = (uiStateController, uiState) => {
  const propValue = uiStateController.getPropFromState(uiState);
  const domValue = asControlHostValue(propValue, {
    controlType: uiStateController.controlType,
    type: uiStateController.controlHostProps.type,
    inputMode: uiStateController.controlHostProps.inputMode,
  });
  if (isSerializableAsDomValue(domValue)) {
    return domValue;
  }
  const controllerId = uiStateController.id;
  naviJsRegistry.set(controllerId, domValue);
  return `window.__navi_js('${controllerId}')`;
};
window.__navi_js = (id) => naviJsRegistry.get(id);
const isSerializableAsDomValue = (value) => {
  if (value === null || value === undefined) {
    return true;
  }
  const type = typeof value;
  return type === "string" || type === "number" || type === "boolean";
};

export const onUIStateControllerCreated = (uiStateController) => {
  const { id, name, controlType } = uiStateController;
  if (id) {
    controllersById.set(id, uiStateController);
  }
  const proxyFor = uiStateController.props["navi-control-proxy-for"];
  if (proxyFor) {
    proxyControllerByRealInputId.set(proxyFor, uiStateController);
  }
  if (
    controlType === "input" &&
    uiStateController.props.type === "radio" &&
    name
  ) {
    let set = radioControllersByName.get(name);
    if (!set) {
      set = new Set();
      radioControllersByName.set(name, set);
    }
    set.add(uiStateController);
  }
};
export const onUIStateControllerDestroyed = (uiStateController) => {
  const { id, name, controlType } = uiStateController;
  if (id) {
    controllersById.delete(id);
    naviJsRegistry.delete(id);
  }
  const proxyFor = uiStateController.props["navi-control-proxy-for"];
  if (proxyFor) {
    proxyControllerByRealInputId.delete(proxyFor);
  }
  if (
    controlType === "input" &&
    uiStateController.controlHostProps.type === "radio" &&
    name
  ) {
    const set = radioControllersByName.get(name);
    if (set) {
      set.delete(uiStateController);
      if (set.size === 0) {
        radioControllersByName.delete(name);
      }
    }
  }
};

/**
 * Controller-based equivalent of findControlProxyTarget.
 * Given a proxy controller, returns the real control's controller.
 * Finds the target by walking the parent controller's children — no DOM queries.
 * Returns `null` when the controller is not a proxy or the target is not found.
 */
export const findControlProxyTargetController = (controller) => {
  const proxyFor = controller.controlHostProps["navi-control-proxy-for"];
  if (!proxyFor) {
    return null;
  }
  return getUIStateControllerById(proxyFor) ?? null;
};

// Reverse-lookup map: real-input id → proxy controller that references it via
// `navi-control-proxy-for`. Maintained on create/destroy so lookup is O(1).
const proxyControllerByRealInputId = new Map();
export const findProxyController = (realInputId) => {
  if (!realInputId) {
    return null;
  }
  return proxyControllerByRealInputId.get(realInputId) ?? null;
};
