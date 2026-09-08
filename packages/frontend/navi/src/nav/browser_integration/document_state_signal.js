import { signal } from "@preact/signals";

export const documentStateSignal = signal(null);
export const useDocumentState = () => {
  return documentStateSignal.value;
};
export const updateDocumentState = (value) => {
  documentStateSignal.value = value;
};

/**
 * What the history entry being written ends up holding.
 *
 * `state`:
 * - `undefined` — a neutral navigation: a link click, a `replaceUrl` writing a
 *   search param. A **replace** stays on the entry the document is already on,
 *   so what that entry holds stays with it. A **push** opens a NEW entry, and
 *   what was written for the one being left — an open dialog, an expanded
 *   picker (see `useNavState`) — describes that entry alone: carried forward it
 *   would reopen on the next screen, and on the one after that, until something
 *   mounting the same id opens out of nowhere.
 * - `null` — an explicit reset.
 * - an object — built by the caller (`enter()`/`leave()` copy the current state
 *   themselves), taken as given.
 *
 * `sharedState` always wins: it describes the document, not the entry.
 *
 * The push/replace split is the Navigation API's own rule for a `navigate()`
 * carrying no state — which is why via_navigation.js gets it from the browser
 * and via_history.js has to spell it out to say the same thing.
 */
export const resolveEffectiveDocumentState = (
  state,
  { navigationType, currentState, sharedState },
) => {
  if (state === undefined) {
    if (navigationType === "push") {
      return sharedState;
    }
    return { ...(currentState || {}), ...sharedState };
  }
  if (state === null) {
    return sharedState;
  }
  return { ...state, ...sharedState };
};

// Preact's own useId() (see preact/hooks) returns "P<mask0>-<mask1>", where the
// mask is derived from render order within the nearest root/async boundary:
// stable across re-renders of the same mount, but not across two mounts on the
// same page, and not across two documents.
const PREACT_GENERATED_ID_REGEX = /^P\d+-\d+/;
export const isLikelyPreactGeneratedId = (id) => {
  return PREACT_GENERATED_ID_REGEX.test(id);
};

/**
 * A history entry outlives the document that wrote it: `history.state` comes
 * back as it was left on a reload, and on a back/forward into a document that
 * has been unloaded since.
 *
 * A key named by a generated id names a position in the render order of the
 * document that wrote it, and nothing else. Read back in another document the
 * same key names whatever now renders at that position — so an open popup left
 * behind by the previous document opens a component nobody ever touched (see
 * `useNavState`, whose key presence IS the open state). Only a caller-given id
 * means the same thing on both sides of a load.
 *
 * Returns the state untouched when it holds no such key, so the caller can tell
 * whether the entry needs rewriting.
 */
export const dropGeneratedIdKeys = (state) => {
  if (!state) {
    return state;
  }
  let stateWithoutGeneratedIdKeys = state;
  for (const key of Object.keys(state)) {
    if (!isLikelyPreactGeneratedId(key)) {
      continue;
    }
    if (stateWithoutGeneratedIdKeys === state) {
      stateWithoutGeneratedIdKeys = { ...state };
    }
    delete stateWithoutGeneratedIdKeys[key];
  }
  return stateWithoutGeneratedIdKeys;
};
