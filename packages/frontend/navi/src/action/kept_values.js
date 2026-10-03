/*
 * Where an action that declares no provisionalValue of its own finds one: the
 * value the page kept from the previous document, for a route action that is
 * not a resource read (see keepPageOnScreen in nav/page_kept.js). routeAction
 * adds the source when it binds the action; a run asks for it at its start,
 * like it asks provisionalValue (actions.js).
 *
 * A registry beside actions.js rather than an import of the kept reads: those
 * know about stores and params keys, which import actions.js.
 */

const keptValueSourcesWeakMap = new WeakMap();
export const addKeptValueSource = (rootAction, source) => {
  let sources = keptValueSourcesWeakMap.get(rootAction);
  if (!sources) {
    sources = [];
    keptValueSourcesWeakMap.set(rootAction, sources);
  }
  sources.push(source);
};
export const takeKeptValue = (action, params) => {
  const rootAction = action.rootAction || action;
  const sources = keptValueSourcesWeakMap.get(rootAction);
  if (!sources) {
    return undefined;
  }
  for (const source of sources) {
    const value = source(params);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};
