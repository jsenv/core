import { createIterableWeakSet } from "@jsenv/dom";

import { getActionPrivateProperties } from "./action_private_properties.js";
import { ABORTED } from "./action_run_states.js";

/*
 * Who asks for an action instance right now, and what a run called off for
 * want of askers owes to whoever comes next.
 *
 * Instances are shared by params: two route actions reading the same thing
 * with the same params, or a route action and a component reading it with
 * `run: true`, ask ONE instance. So a binding whose params turn falsy (its
 * route left) does not own the run in flight: it calls it off only when
 * nothing else asks for that instance at that moment. What asks is an asker:
 * a binding of actionRunEffect while its params are truthy, a mounted
 * `useAsyncData` reader with `run: true`. Each says which instance it asks for
 * when the question is put, rather than registering one: a reader of a
 * binding follows the binding's target the moment it moves, not at its next
 * render.
 *
 * Calling a run off is a guess about who is coming: a reader mounting after
 * it (the page arriving), or suspended before its first commit, finds an
 * instance nobody will run again. So the instance is marked, and a `run: true`
 * reader finding it marked asks again, as an arriving binding does when its
 * run() finds the instance aborted. An abort decided by anyone else (abort(),
 * a give-up on a busy popup) carries no mark: aborting does not undo, and the
 * reader leaves it be.
 */

const askerSet = createIterableWeakSet("action_asker");

/**
 * `readAskedInstance()` returns what is asked for now: an instance, a binding
 * (its current target is what counts), or null. The asker is held weakly:
 * whoever adds it keeps it, and removes it once it asks for nothing for good.
 */
export const addActionAsker = (readAskedInstance) => {
  const asker = { readAskedInstance };
  askerSet.add(asker);
  return asker;
};
export const removeActionAsker = (asker) => {
  askerSet.delete(asker);
};

const calledOffWeakSet = new WeakSet();

/**
 * Aborts the instance's run unless an asker asks for it, and marks a run
 * called off that way (see isCalledOffForWantOfAskers).
 */
export const callOffUnlessAsked = (action, reason) => {
  const instance = resolveInstance(action);
  for (const asker of askerSet) {
    if (resolveInstance(asker.readAskedInstance()) === instance) {
      return;
    }
  }
  if (!instance.abort(reason)) {
    return;
  }
  // A callback that ignores its abort signal completes all the same.
  if (instance.runningStateSignal.peek() !== ABORTED) {
    return;
  }
  calledOffWeakSet.add(instance);
  // The mark is for this abort only: once the instance moves, an abort that
  // comes later is somebody else's.
  const unsubscribe = instance.runningStateSignal.subscribe((state) => {
    if (state !== ABORTED) {
      calledOffWeakSet.delete(instance);
      unsubscribe();
    }
  });
};

export const isCalledOffForWantOfAskers = (action) => {
  return calledOffWeakSet.has(resolveInstance(action));
};

// A binding counts as the instance it targets now. Read as it stands, never
// through getCurrentAction(), which would flush a debounced binding.
const resolveInstance = (action) => {
  let instance = action;
  while (instance && instance.isProxy) {
    instance = getActionPrivateProperties(instance).currentAction;
  }
  return instance;
};
