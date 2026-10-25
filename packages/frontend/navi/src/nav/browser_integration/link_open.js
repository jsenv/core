/*
 * A page reached with one of its popups open — "see how it is computed" leads
 * to a profile with its results sheet over it. Closing the sheet leaves the
 * reader on the profile, and only then does Back leave the profile: the page's
 * entry, then the popup's, as the press on a link and then the popup's own
 * opening would have written them.
 *
 * The popup is named the way its `navState` names it, since that is where its
 * open state lives: its key, and whether its opening pushes an entry of its
 * own. A popup bound to a `signal` holding a url param needs none of this: its
 * open state IS the address (`buildUrl`).
 *
 * `<Link open>`, or `navTo(url, { open })`. It travels as an attribute for the
 * same reason as `replace` (see link_replace.js): whoever answers the press
 * sees the element, not the component that rendered it.
 */

import { isArrival } from "./scroll_restoration.js";

export const LINK_OPEN_ATTRIBUTE = "data-navi-open";

export const linkAsksToOpen = (linkElement) => {
  const openAttribute = linkElement.getAttribute(LINK_OPEN_ATTRIBUTE);
  return openAttribute === null ? undefined : JSON.parse(openAttribute);
};

/**
 * What a popup's `navState` says, as the key and the kind of entry its opening
 * writes. Only the forms that name a key: `navState={true}` takes the popup's
 * own id, which nothing here can know.
 */
export const resolveOpenOnArrival = (open) => {
  if (typeof open === "string") {
    return { id: open, type: "replace" };
  }
  if (import.meta.dev && (!open || typeof open.id !== "string")) {
    console.warn(
      `[navi] "open" names a popup the way its navState does: "key", or { id: "key", type: "push" }. Got ${JSON.stringify(open)}.`,
    );
  }
  return { id: open.id, type: open.type || "replace" };
};

// What an opening writes under the popup's key (useNavState's enter()).
export const NAV_STATE_ENTERED_VALUE = "on";

/**
 * The state of the page's own entry: what a push would give it, said
 * explicitly. An entry with something of its own is never taken for the one
 * next door (a push is turned into a traversal only when it brings nothing),
 * and the popup's entry is stacked over this one.
 */
export const readPageStateUnderPopup = (url, { state, urlLeft, stateLeft }) => {
  if (state !== undefined) {
    return state || {};
  }
  if (isArrival(url, { from: urlLeft })) {
    return {};
  }
  return stateLeft || {};
};
