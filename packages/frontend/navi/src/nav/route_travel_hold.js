/**
 * What a hand holding a row of routes leaves the address unable to say.
 *
 * A page not built yet builds by the address moving, so the address runs ahead of
 * the hand. Nothing is decided while the hand holds the row: whatever says where the
 * reader is answers from here until the hand lets go.
 *
 * Apart from route_travel.jsx so that every link can read it without bringing a row
 * along.
 */

import { signal } from "@preact/signals";

/**
 * The page the reader is still on while a hand holds the row and the address has run
 * ahead of it, `null` otherwise. A link to a page of the row answers from it by
 * itself; a counter, a title or a breadcrumb around the box reads it first.
 *
 * It goes back to `null` as soon as the hand has let go and the row moves. Nothing
 * says when the fingers leave a trackpad: there it is the page nearest the row, until
 * the row has come to rest. A travel no hand set off holds nothing: it goes where it
 * goes.
 *
 * One for the document. `route` says which row, for a page holding several boxes.
 */
export const routeTravelSettledPageSignal = signal(null);

// Where the address ran ahead to. A link has to tell it from any other link that
// matches the address: an entry of a bottom bar whose route is a section around the
// row stays lit.
const headingPageSignal = signal(null);

export const holdPage = (page, headingPage) => {
  headingPageSignal.value = headingPage;
  if (routeTravelSettledPageSignal.peek() === null) {
    routeTravelSettledPageSignal.value = page;
  }
};

// A hand no browser says has let go: the page nearest the row is where the reader is,
// and the address, wherever it stands, is not.
export const followPageOnScreen = (page, addressPage) => {
  headingPageSignal.value = addressPage;
  routeTravelSettledPageSignal.value = page;
};

export const releaseHeldPage = () => {
  routeTravelSettledPageSignal.value = null;
  headingPageSignal.value = null;
};

/**
 * What a link to `route` with `params` answers because a hand holds a row.
 *
 * @returns {boolean|undefined} `undefined` when the hold says nothing about this
 *   link, and the address answers.
 */
export const readHeldLinkCurrent = (route, params) => {
  const settledPage = routeTravelSettledPageSignal.value;
  const headingPage = headingPageSignal.value;
  if (!settledPage) {
    return undefined;
  }
  // By address: a link may name fewer params than the page it leads to.
  const leadsTo = (page) =>
    page.route === route &&
    route.buildUrl(params) === route.buildUrl(page.params);
  if (leadsTo(settledPage)) {
    return true;
  }
  if (leadsTo(headingPage)) {
    return false;
  }
  return undefined;
};
