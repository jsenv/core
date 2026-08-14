/**
 * How a control tells the labels pointing at it what it is (disabled, readOnly,
 * required) and when it goes away.
 *
 * A label linked to its control by id has no DOM relationship to walk: the two
 * only know each other's id. A non-native control has no `element.labels`
 * either, so the only way to go from the control to its labels through the DOM
 * is to ask the whole document for `label[for="…"]` — once per control, on a
 * document that every mounted control makes bigger.
 *
 * The link is held here instead. The control publishes its state under its own
 * id; a label subscribes to the id it points at. Order does not matter —
 * whichever mounts second finds what the first left, so a label written after
 * its control is told just as much as one written before it.
 *
 * A label that WRAPS its control has the native relationship already
 * (`element.labels`) and is notified through a DOM event instead — see
 * `getAssociatedLabels` in control_hooks.jsx. Both channels carry the same
 * values and land on the same setters, so a control reachable through both is
 * simply told twice.
 */

const stateByControlId = new Map();
const callbackSetByControlId = new Map();

export const publishControlStateToLabels = (controlId, controlState) => {
  if (!controlId) {
    return;
  }
  stateByControlId.set(controlId, controlState);
  const callbackSet = callbackSetByControlId.get(controlId);
  if (callbackSet) {
    for (const callback of callbackSet) {
      callback(controlState);
    }
  }
};

export const unpublishControlStateToLabels = (controlId) => {
  if (!controlId) {
    return;
  }
  stateByControlId.delete(controlId);
  const callbackSet = callbackSetByControlId.get(controlId);
  if (callbackSet) {
    for (const callback of callbackSet) {
      callback(null);
    }
  }
};

/**
 * Subscribes to the state published by the control identified by `controlId`.
 * The callback is called right away with the current state (or `null` when no
 * such control is mounted), then on every change. Returns the teardown.
 */
export const subscribeToControlState = (controlId, callback) => {
  let callbackSet = callbackSetByControlId.get(controlId);
  if (!callbackSet) {
    callbackSet = new Set();
    callbackSetByControlId.set(controlId, callbackSet);
  }
  callbackSet.add(callback);
  callback(stateByControlId.get(controlId) ?? null);
  return () => {
    callbackSet.delete(callback);
    if (callbackSet.size === 0) {
      callbackSetByControlId.delete(controlId);
    }
  };
};
