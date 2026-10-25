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
 *   so what that entry holds stays with it. A **push** opens a NEW entry. One
 *   arriving at another page (`isArrival`, see scroll_restoration.js) starts
 *   empty: what was written for the entry being left — an open dialog, an
 *   expanded picker (see `useNavState`) — describes that entry alone, and
 *   carried forward it would reopen on the next screen, and on the one after
 *   that, until something mounting the same id opens out of nowhere. A push
 *   that keeps the page (a layer bound to a search param, opened over it)
 *   carries the state: whatever holds it is still mounted under the new
 *   address, and an empty entry would close it there — an expanded row
 *   collapsing under the layer, expanding again when the back takes it away.
 * - `null` — an explicit reset.
 * - an object — built by the caller (`enter()`/`leave()` copy the current state
 *   themselves), taken as given.
 *
 * `currentState` is what the entry being left holds. `sharedState` always
 * wins: it describes the document, not the entry.
 */
export const resolveEffectiveDocumentState = (
  state,
  { navigationType, isArrival, currentState, sharedState },
) => {
  if (state === undefined) {
    if (navigationType === "push" && isArrival) {
      return sharedState;
    }
    return { ...(currentState || {}), ...sharedState };
  }
  if (state === null) {
    return sharedState;
  }
  return { ...state, ...sharedState };
};

/**
 * What a press on a link handed to the navigation it starts (see the
 * integrations' `carryByLinkNavigation`): each write is an `editState` applied
 * to the entry that navigation writes, and an `otherwise` that makes the write
 * where it would have been made, for a press that starts no navigation here.
 */
export const applyPressWrites = (state, pressWrites) => {
  if (!pressWrites) {
    return state;
  }
  let stateWritten = state;
  for (const { editState } of pressWrites) {
    stateWritten = editState(stateWritten);
  }
  return stateWritten;
};
export const writePressWritesHere = (pressWrites) => {
  if (!pressWrites) {
    return;
  }
  for (const { otherwise } of pressWrites) {
    otherwise();
  }
};

// An id made up at render names one mount: navi's own ("navi_<n>", see
// useGeneratedId) counts mounts in the document, and preact's useId(), which
// an app may hand a component, gives "P<mask0>-<mask1>" from the render order.
// Neither names the same component in two mounts or two documents.
const GENERATED_ID_REGEX = /^(?:navi_\d+|P\d+-\d+)/;
export const isGeneratedId = (id) => {
  return GENERATED_ID_REGEX.test(id);
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
    if (!isGeneratedId(key)) {
      continue;
    }
    if (stateWithoutGeneratedIdKeys === state) {
      stateWithoutGeneratedIdKeys = { ...state };
    }
    delete stateWithoutGeneratedIdKeys[key];
  }
  return stateWithoutGeneratedIdKeys;
};
