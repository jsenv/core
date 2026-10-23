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
 *
 * The link also runs the other way, for a control whose role is on its root
 * (`nameOn: "root"`, a wheel): a label[for] can only point at its host, an
 * aria-hidden carrier, and names nothing. That control says so in the state it
 * publishes; its label then drops `for` and publishes its own id under the
 * control's id instead, and the control names its root with the ids it finds
 * there (aria-labelledby). A label[for] kept as well would name the carrier
 * too, and a lookup by label would find two elements.
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

const labelIdSetByControlId = new Map();
const labelCallbackSetByControlId = new Map();

const notifyLabelIds = (controlId) => {
  const callbackSet = labelCallbackSetByControlId.get(controlId);
  if (!callbackSet) {
    return;
  }
  const labelIds = readLabelIds(controlId);
  for (const callback of callbackSet) {
    callback(labelIds);
  }
};
// One string ("label_a label_b"), the shape aria-labelledby takes, and equal
// from one call to the next while nothing changed.
const readLabelIds = (controlId) => {
  const labelIdSet = labelIdSetByControlId.get(controlId);
  return labelIdSet ? Array.from(labelIdSet).join(" ") : undefined;
};

/**
 * Publishes `labelId` as a label of the control identified by `controlId`.
 * Returns the teardown.
 */
export const publishLabelToControl = (controlId, labelId) => {
  let labelIdSet = labelIdSetByControlId.get(controlId);
  if (!labelIdSet) {
    labelIdSet = new Set();
    labelIdSetByControlId.set(controlId, labelIdSet);
  }
  labelIdSet.add(labelId);
  notifyLabelIds(controlId);
  return () => {
    labelIdSet.delete(labelId);
    if (labelIdSet.size === 0) {
      labelIdSetByControlId.delete(controlId);
    }
    notifyLabelIds(controlId);
  };
};

/**
 * Subscribes to the ids of the labels published for `controlId`. The callback
 * is called right away (with `undefined` when there is none), then on every
 * change. Returns the teardown.
 */
export const subscribeToControlLabels = (controlId, callback) => {
  let callbackSet = labelCallbackSetByControlId.get(controlId);
  if (!callbackSet) {
    callbackSet = new Set();
    labelCallbackSetByControlId.set(controlId, callbackSet);
  }
  callbackSet.add(callback);
  callback(readLabelIds(controlId));
  return () => {
    callbackSet.delete(callback);
    if (callbackSet.size === 0) {
      labelCallbackSetByControlId.delete(controlId);
    }
  };
};
