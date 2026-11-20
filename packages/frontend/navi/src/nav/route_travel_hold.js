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

import { computed, signal } from "@preact/signals";

// One hold per row a hand holds or has just let go of, the latest last. A page
// can hold several rows — a row of tabs in a page of another row — and each row
// lets go of its own hold only: one coming to rest, or leaving, must not light
// the tabs of a row a hand still holds. Each hold says the page the reader is
// still on (`settled`) and where the address ran ahead to (`heading`): a link
// has to tell that one from any other link that matches the address, an entry
// of a bottom bar whose route is a section around the row staying lit.
const holdsSignal = signal([]);

const writeHold = (row, hold) => {
  const holds = holdsSignal.peek().filter((each) => each.row !== row);
  holdsSignal.value = hold ? [...holds, { row, ...hold }] : holds;
};

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
 * One for the document: the row held last. `route` says which row, for a page
 * holding several boxes.
 */
export const routeTravelSettledPageSignal = computed(() => {
  const holds = holdsSignal.value;
  return holds.length === 0 ? null : holds[holds.length - 1].settled;
});

// The page the reader is on stays what it was when the hand took the row: only
// where the address runs ahead to follows the hand.
export const holdPage = (row, page, headingPage) => {
  const current = holdsSignal.peek().find((each) => each.row === row);
  writeHold(row, {
    settled: current ? current.settled : page,
    heading: headingPage,
  });
};

// A hand no browser says has let go: the page nearest the row is where the reader is,
// and the address, wherever it stands, is not.
export const followPageOnScreen = (row, page, addressPage) => {
  writeHold(row, { settled: page, heading: addressPage });
};

export const releaseHeldPage = (row) => {
  if (holdsSignal.peek().some((each) => each.row === row)) {
    writeHold(row, null);
  }
};

/**
 * What a link to `route` with `params` answers because a hand holds a row.
 *
 * @returns {boolean|undefined} `undefined` when the hold says nothing about this
 *   link, and the address answers.
 */
export const readHeldLinkCurrent = (route, params) => {
  const holds = holdsSignal.value;
  if (holds.length === 0) {
    return undefined;
  }
  // By address: a link may name fewer params than the page it leads to.
  const leadsTo = (page) =>
    Boolean(page) &&
    page.route === route &&
    route.buildUrl(params) === route.buildUrl(page.params);
  for (const { settled } of holds) {
    if (leadsTo(settled)) {
      return true;
    }
  }
  for (const { heading } of holds) {
    if (leadsTo(heading)) {
      return false;
    }
  }
  return undefined;
};
