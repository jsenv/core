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
