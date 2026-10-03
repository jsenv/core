import { effect } from "@preact/signals";

import { getActionPrivateProperties } from "../action/action_private_properties.js";
import { COMPLETED } from "../action/action_run_states.js";
import { NO_PARAMS } from "../action/actions.js";
import {
  getKeptReadKey,
  isKeepableRead,
  offerKeptReads,
  serializeData,
  shownRangeReadersSignal,
  withdrawKeptReads,
} from "../state/rest/kept_reads.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { isSignal } from "../utils/is_signal.js";
import { routedSignal } from "./route.js";
import {
  activeRouteActionsSignal,
  anyMatchingRouteSignal,
} from "./route_action.js";

/*
 * The page on screen, kept for the next document: what its reads answered,
 * written into a signal the app hands over, and drawn again by the same reads
 * in a document opening on the same page (a reload, a tab the system
 * discarded). The read side is state/rest/kept_reads.js; this is what decides
 * which reads are the page, and when the slot is written.
 *
 * The unit is the page, not the resource. One resource is read by several
 * screens — a search, someone's games, a game opened from anywhere — and kept
 * per resource it would keep every row ever opened. The page's reads are what
 * navi already runs for it: the route actions asking something for the page
 * (activeRouteActionsSignal) and the compositions the lists on screen read
 * (shownRangeReadersSignal). A search typed on the page is neither, and is not
 * kept.
 *
 * A read is written once it has answered in this document. Before that it
 * keeps what the previous document kept for it, never what it shows meanwhile:
 * an answer handed over from other params (a list standing in for the next
 * one) says nothing about these.
 *
 * The write waits for the page to settle and is flushed when the document is
 * hidden. A navigation goes through pages half there — the route matched, its
 * list not mounted yet, the page left still drawn under a transition — and
 * each would otherwise be written out in full. Hidden is the moment the system
 * may discard the document, so nothing is lost by waiting until then.
 *
 * The signal turning `undefined` from outside (sign-out) forgets the page, and
 * nothing is written until a read lands again: written at once, the page still
 * on screen would put back the account just left.
 */

const WRITE_DELAY = 1000;
const NOTHING_PENDING = {};
let stopKeepingCurrent = null;

/**
 * Keeps what the page on screen reads, so that a new document opening on it —
 * a reload, a pull-to-refresh, a tab the system discarded in the background —
 * draws it again while its reads go out, rather than skeletons.
 *
 * What the page reads is what navi runs for it: the route actions asking
 * something for it (see `activeRouteActionsSignal`) whose action is a resource
 * `GET` or `GET_MANY`, and the `GET_RANGE` compositions the `<List.Items>` on
 * screen read, around the window they draw. A navigation replaces the slot with
 * the next page's reads, and the page left is dropped. In the next document,
 * the first run of the same read with the same params draws the kept answer as
 * its provisional value: `data` set while `loading` is `true`, the answer
 * replacing it. Under a network policy answering reads from the store, the
 * kept answer answers the read. The copy follows the store: a `PUT` on a row
 * rewrites it.
 *
 * Call it before the routes start: the first runs are the ones that look.
 *
 * @param {object} options
 * @param {import("@preact/signals").Signal} options.signal - where the slot is
 *   written: a `stateSignal` with `persists: true` and `type: "object"`, its
 *   `id` holding whatever makes a kept page unusable (the deployed version).
 *   Writing `undefined` into it (sign-out) forgets the page, and nothing is
 *   written again until a read lands.
 * @param {() => boolean} [options.when] - read whenever the slot is about to be
 *   read or written: `false` reads nothing, writes nothing, and empties the
 *   signal (a tab viewing as someone else). A function, so it can read a signal.
 * @param {object[]} [options.always] - routes whose reads stay kept once the
 *   page is left, until it is visited again: the page an app opens on when it
 *   is launched rather than reloaded.
 * @returns {() => void} stops keeping the page.
 * @see docs/resource.md — what is kept and what is not, what stays the app's
 */
export const keepPageOnScreen = ({
  signal: keptSignal,
  when,
  always = [],
} = {}) => {
  if (!isSignal(keptSignal)) {
    throw new TypeError(
      `keepPageOnScreen() needs a signal to write the page into, received ${keptSignal}`,
    );
  }
  if (stopKeepingCurrent) {
    stopKeepingCurrent();
  }
  const isAllowed = () => {
    return when ? Boolean(when()) : true;
  };
  const alwaysMatchingSignal = anyMatchingRouteSignal(always);

  // What the signal held when it was read: the previous document's page.
  let loadedEntryMap = new Map();
  let loadedAlwaysKeys = [];
  // Which reads answered in this document (since the last forget): only
  // those write what they show.
  let answeredActionWeakSet = new WeakSet();
  let answeredRangeKeySet = new Set();
  // The state each action was last seen in, and the last answer seen of each
  // range reader: a read lands when they move, and not because the slot looks
  // again at something that had answered before a forget.
  const stateSeenWeakMap = new WeakMap();
  const answeredAtSeenWeakMap = new WeakMap();
  // Forgotten: nothing is written until a read lands.
  let paused = false;
  // The reads of the always-kept page, as they were the last time it was on
  // screen in this document; null until then.
  let alwaysReads = null;

  const forget = () => {
    loadedEntryMap = new Map();
    loadedAlwaysKeys = [];
    answeredActionWeakSet = new WeakSet();
    answeredRangeKeySet = new Set();
    alwaysReads = null;
    paused = true;
    withdrawKeptReads();
  };

  let lastWritten;
  let pendingWrite = NOTHING_PENDING;
  let writeTimeout;
  const flush = () => {
    clearTimeout(writeTimeout);
    if (pendingWrite === NOTHING_PENDING) {
      return;
    }
    const value = pendingWrite;
    pendingWrite = NOTHING_PENDING;
    if (compareTwoJsValues(value, lastWritten)) {
      return;
    }
    lastWritten = value;
    keptSignal.value = value;
  };
  const scheduleWrite = (value) => {
    pendingWrite = value;
    clearTimeout(writeTimeout);
    writeTimeout = setTimeout(flush, WRITE_DELAY);
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flush);

  // Runs at once with what the signal already holds (the slot read from
  // storage), then on every write — the slot's own ones are recognized and
  // left alone.
  const unsubscribe = keptSignal.subscribe((value) => {
    if (value === lastWritten) {
      return;
    }
    lastWritten = value;
    pendingWrite = NOTHING_PENDING;
    clearTimeout(writeTimeout);
    if (
      value === undefined ||
      value === null ||
      typeof value !== "object" ||
      !isAllowed()
    ) {
      forget();
      return;
    }
    const entries =
      value.entries && typeof value.entries === "object" ? value.entries : {};
    loadedEntryMap = new Map(Object.entries(entries));
    loadedAlwaysKeys = Array.isArray(value.always)
      ? value.always.filter((key) => loadedEntryMap.has(key))
      : [];
    alwaysReads = null;
    paused = false;
    offerKeptReads(loadedEntryMap);
  });

  const actionReadWeakMap = new WeakMap();
  const actionReadOf = (action) => {
    let read = actionReadWeakMap.get(action);
    if (read) {
      return read;
    }
    read = () => {
      const state = action.runningStateSignal.value;
      const stateSeen = stateSeenWeakMap.get(action);
      stateSeenWeakMap.set(action, state);
      const landed = state === COMPLETED && stateSeen !== COMPLETED;
      if (landed) {
        answeredActionWeakSet.add(action);
      }
      return {
        key: getKeptReadKey(action.name, action.params),
        answered: answeredActionWeakSet.has(action),
        landed,
        readEntry: () => {
          const data = action.dataSignal.value;
          if (data === undefined || data === null) {
            return undefined;
          }
          return serializeData(data);
        },
      };
    };
    actionReadWeakMap.set(action, read);
    return read;
  };
  const rangeReadWeakMap = new WeakMap();
  const rangeReadOf = (reader) => {
    let read = rangeReadWeakMap.get(reader);
    if (read) {
      return read;
    }
    read = () => {
      const { key, answeredAt, readEntry } = reader.readKept();
      const answeredAtSeen = answeredAtSeenWeakMap.get(reader) || 0;
      answeredAtSeenWeakMap.set(reader, answeredAt);
      const landed = answeredAt > answeredAtSeen;
      if (landed) {
        answeredRangeKeySet.add(key);
      }
      return {
        key,
        answered: answeredRangeKeySet.has(key),
        landed,
        readEntry,
      };
    };
    rangeReadWeakMap.set(reader, read);
    return read;
  };
  const readsOnScreen = () => {
    const reads = [];
    for (const routeAction of activeRouteActionsSignal.value) {
      // The instance is what is kept, so that a page left keeps what it read.
      // The binding's callSource names that instance and is rewritten once the
      // binding has moved to another one: read, it brings the slot along.
      // eslint-disable-next-line no-unused-expressions
      routeAction.callSource;
      const action = getActionPrivateProperties(routeAction).currentAction;
      if (action.params === NO_PARAMS || !isKeepableRead(action)) {
        continue;
      }
      reads.push(actionReadOf(action));
    }
    for (const reader of shownRangeReadersSignal.value.keys()) {
      reads.push(rangeReadOf(reader));
    }
    return reads;
  };

  const stopEffect = effect(() => {
    const allowed = isAllowed();
    const routed = routedSignal.value;
    const alwaysMatching = alwaysMatchingSignal.value;
    if (!allowed) {
      forget();
      pendingWrite = undefined;
      flush();
      return;
    }
    if (!routed) {
      // No page yet: the slot is what the first reads will draw.
      return;
    }
    const screenReads = readsOnScreen();
    if (alwaysMatching) {
      alwaysReads = screenReads;
    }
    const entries = {};
    let landed = false;
    const collect = (reads) => {
      const keys = [];
      for (const read of reads) {
        const result = read();
        if (result.landed) {
          landed = true;
        }
        const entry = result.answered
          ? result.readEntry()
          : loadedEntryMap.get(result.key);
        if (entry === undefined) {
          continue;
        }
        entries[result.key] = entry;
        keys.push(result.key);
      }
      return keys;
    };
    const screenKeys = collect(screenReads);
    let alwaysKeys;
    if (alwaysReads === screenReads) {
      alwaysKeys = screenKeys;
    } else if (alwaysReads) {
      alwaysKeys = collect(alwaysReads);
    } else {
      alwaysKeys = loadedAlwaysKeys;
      for (const key of alwaysKeys) {
        entries[key] = loadedEntryMap.get(key);
      }
    }
    if (paused) {
      if (!landed) {
        return;
      }
      paused = false;
    }
    if (screenKeys.length === 0 && alwaysKeys.length === 0) {
      scheduleWrite(undefined);
      return;
    }
    scheduleWrite({ entries, screen: screenKeys, always: alwaysKeys });
  });

  const stop = () => {
    flush();
    stopEffect();
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", flush);
    withdrawKeptReads();
    if (stopKeepingCurrent === stop) {
      stopKeepingCurrent = null;
    }
  };
  stopKeepingCurrent = stop;
  return stop;
};
