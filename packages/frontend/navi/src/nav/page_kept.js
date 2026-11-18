import { effect, untracked } from "@preact/signals";

import { getActionPrivateProperties } from "../action/action_private_properties.js";
import { COMPLETED } from "../action/action_run_states.js";
import { NO_PARAMS } from "../action/actions.js";
import {
  getKeptReadKey,
  isKeepableRead,
  isRelationshipRead,
  observeKeptFrameMoved,
  offerKeptReads,
  serializeData,
  shownRangeReadersSignal,
  withdrawKeptReads,
} from "../state/rest/kept_reads.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { isSignal } from "../utils/is_signal.js";
import { whenDocumentMayEnd } from "./browser_integration/document_may_end.js";
import { routedSignal } from "./route.js";
import {
  activeRouteActionsSignal,
  anyMatchingRouteSignal,
  getRouteActionKeptName,
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
 * What a read is made of on the way out depends on what it holds. A resource
 * read holds ids, which name rows a new document's store does not have: its
 * rows are written, and re-enter the store. Any other route action holds its
 * value, written as it is when JSON brings it back as it was — a page's code
 * (a function), a Date built by the callback, a Map, are not, and are left
 * out. Such an action is recognized in the next document by its place among
 * the route actions declared (see getRouteActionKeptName), not by a name the
 * app would have to give every action made from a callback.
 *
 * A relationship read (`.one()`, `.many()`, `.scopedOne()`, `.scopedMany()`)
 * is neither: its value is ids into another store, under an owner a new
 * document may not hold yet. It is not kept.
 *
 * A read is written once it has answered in this document. Before that it
 * keeps what the previous document kept for it, never what it shows meanwhile:
 * an answer handed over from other params (a list standing in for the next
 * one) says nothing about these.
 *
 * Which reads are the page is followed as it moves; what they hold is written
 * out only when the slot is written, once the page has settled, and whenever
 * the document may end (see document_may_end.js). A navigation goes through
 * pages half there — the route matched, its list not mounted yet, the page left
 * still drawn under a transition — and a list scrolled moves the window kept of
 * it at every step: each would otherwise be written out in full, rows and
 * relations, in the middle of a render. A row changing without the page moving
 * is written with the next write; the document ending is the last one, and
 * nothing the next document reads is older than that.
 *
 * The signal turning `undefined` from outside (sign-out) forgets the page, and
 * nothing is written until a read lands again: written at once, the page still
 * on screen would put back the account just left.
 */

const WRITE_DELAY = 1000;
let stopKeepingCurrent = null;

/**
 * Keeps what the page on screen reads, so that a new document opening on it —
 * a reload, a pull-to-refresh, a tab the system discarded in the background —
 * draws it again while its reads go out, rather than skeletons.
 *
 * What the page reads is what navi runs for it: the route actions asking
 * something for it (see `activeRouteActionsSignal`), and the `GET_RANGE`
 * compositions the `<List.Items>` on screen read, around the window they draw.
 * A resource read keeps its rows; any other route action keeps its value when
 * JSON brings it back as it was. A navigation replaces the slot with the next
 * page's reads, and the page left is dropped. In the next document, the first
 * run of the same read with the same params draws the kept answer as its
 * provisional value: `data` set while `loading` is `true`, the answer replacing
 * it. Under a network policy answering reads from the store, a resource read
 * completes with it. The copy follows the store: a `PUT` on a row is written
 * with the next write, and the document ending writes everything.
 *
 * Call it before the routes start: the first runs are the ones that look. And
 * declare the route actions where the app starts: one that is not a resource
 * read is recognized by its place among them.
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
  // The reads the page is made of, as the effect below last followed them:
  // what the slot is built from when it is written. Null while nothing is to
  // be written — nothing routed yet, or forgotten until a read lands.
  let readsToWrite = null;
  let writeTimeout;
  const writeNow = (value) => {
    if (compareTwoJsValues(value, lastWritten)) {
      return;
    }
    lastWritten = value;
    keptSignal.value = value;
  };
  const flush = () => {
    clearTimeout(writeTimeout);
    if (readsToWrite === null) {
      return;
    }
    const reads = readsToWrite;
    writeNow(untracked(() => buildSlot(reads)));
  };
  const scheduleWrite = () => {
    clearTimeout(writeTimeout);
    writeTimeout = setTimeout(flush, WRITE_DELAY);
  };
  const stopFlushingAtEnd = whenDocumentMayEnd(flush);
  const stopFollowingFrames = observeKeptFrameMoved(() => {
    if (readsToWrite !== null) {
      scheduleWrite();
    }
  });

  // Runs at once with what the signal already holds (the slot read from
  // storage), then on every write — the slot's own ones are recognized and
  // left alone.
  const unsubscribe = keptSignal.subscribe((value) => {
    if (value === lastWritten) {
      return;
    }
    lastWritten = value;
    readsToWrite = null;
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
  const actionReadOf = (action, keptName, readEntryOf) => {
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
        key: getKeptReadKey(keptName, action.params),
        answered: answeredActionWeakSet.has(action),
        landed,
        readEntry: () => readEntryOf(action),
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
      if (action.params === NO_PARAMS || isRelationshipRead(action)) {
        continue;
      }
      if (isKeepableRead(action)) {
        reads.push(actionReadOf(action, action.name, readRows));
      } else {
        reads.push(
          actionReadOf(
            action,
            getRouteActionKeptName(routeAction),
            readPlainValue,
          ),
        );
      }
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
      readsToWrite = null;
      clearTimeout(writeTimeout);
      writeNow(undefined);
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
    let landed = false;
    const follow = (reads) =>
      reads.map((read) => {
        const result = read();
        if (result.landed) {
          landed = true;
        }
        return result;
      });
    const screenResults = follow(screenReads);
    let alwaysResults = null;
    if (alwaysReads === screenReads) {
      alwaysResults = screenResults;
    } else if (alwaysReads) {
      alwaysResults = follow(alwaysReads);
    }
    if (paused) {
      if (!landed) {
        return;
      }
      paused = false;
    }
    readsToWrite = { screenResults, alwaysResults };
    scheduleWrite();
  });

  // What a read answered, written out: its rows with their relations inline,
  // or its value. A read that has not answered in this document keeps what
  // the previous document kept for it.
  const buildSlot = ({ screenResults, alwaysResults }) => {
    const entries = {};
    const collect = (results) => {
      const keys = [];
      for (const result of results) {
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
    const screenKeys = collect(screenResults);
    let alwaysKeys;
    if (alwaysResults === screenResults) {
      alwaysKeys = screenKeys;
    } else if (alwaysResults) {
      alwaysKeys = collect(alwaysResults);
    } else {
      alwaysKeys = loadedAlwaysKeys;
      for (const key of alwaysKeys) {
        entries[key] = loadedEntryMap.get(key);
      }
    }
    if (screenKeys.length === 0 && alwaysKeys.length === 0) {
      return undefined;
    }
    return { entries, screen: screenKeys, always: alwaysKeys };
  };

  const stop = () => {
    flush();
    stopEffect();
    unsubscribe();
    stopFlushingAtEnd();
    stopFollowingFrames();
    withdrawKeptReads();
    if (stopKeepingCurrent === stop) {
      stopKeepingCurrent = null;
    }
  };
  stopKeepingCurrent = stop;
  return stop;
};

const readRows = (action) => {
  const data = action.dataSignal.value;
  if (data === undefined || data === null) {
    return undefined;
  }
  return serializeData(data);
};
const readPlainValue = (action) => {
  const value = action.valueSignal.value;
  if (value === undefined || !isPlainData(value, new Set())) {
    return undefined;
  }
  return value;
};
// What JSON writes and reads back as it was. `undefined` inside is accepted:
// JSON drops the key, which reads the same.
const isPlainData = (value, ancestorSet) => {
  if (value === null || value === undefined) {
    return true;
  }
  const type = typeof value;
  if (type === "string" || type === "boolean") {
    return true;
  }
  if (type === "number") {
    return Number.isFinite(value);
  }
  if (type !== "object") {
    return false;
  }
  if (ancestorSet.has(value)) {
    return false;
  }
  const isArray = Array.isArray(value);
  if (!isArray) {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return false;
    }
  }
  ancestorSet.add(value);
  const entries = isArray ? value : Object.values(value);
  for (const entry of entries) {
    if (!isPlainData(entry, ancestorSet)) {
      return false;
    }
  }
  ancestorSet.delete(value);
  return true;
};
