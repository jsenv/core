/*
 * GET_RANGE: reading a resource one slice at a time, for a list that draws its
 * rows as it goes (`<List.Items itemsAction>`).
 *
 * It is on purpose not an action. An action keeps the one response it got and
 * replays it, and takes a place in the rerun graph — two things a slice must
 * not do: the list already holds the slices it received and glues them back
 * together, and a mutation would otherwise send every slice ever loaded back to
 * the network at once. So the reader keeps no response. It runs the callback
 * with the range the list asks for, writes what comes back into the store, and
 * hands the rows back as store items — never a copy of the JSON, so the
 * relations a row reads are the shared ones and a request sent from a row is
 * read back on it. A row following its own fields through a write reads them
 * from the store (`RESOURCE.useById(id)`): an update replaces the item object,
 * and the one the list is holding is the one it was given.
 *
 * What the reader does keep is the collection's composition: which rank holds
 * which id, and how many ranks there are, per resolved bound params. The rows
 * themselves are in the store already; the composition is the one thing about a
 * paginated collection the store cannot model, and without it a list that left
 * the screen comes back to skeletons and a request for rows it had a second
 * before. Ids and a count, so nothing here can hold a stale copy of a row, and
 * a row dropped from the store simply stops resolving. A list that comes back
 * draws the composition it left and asks again for the window it draws — the
 * revalidation an invalidation goes through, from a fresh mount.
 *
 * The reader is a function, so a list feeds on it the way it feeds on any other
 * source: `itemsAction={GAME.GET_RANGE.bindParams({ radar })}`.
 *
 * A mutation that decides who belongs to the collection (a POST, a DELETE,
 * whatever `rerunOn.GET_RANGE` says) bumps `invalidationSignal` and drops the
 * compositions: they stand for an order that is gone. Whoever reads slices
 * through the reader then goes and asks again — the counterpart, for a reader,
 * of what a rerun is for an action. Every reader made by `bindParams` shares
 * the signal and the compositions of the one it comes from: the params say
 * which slices are read, not which collection.
 */

import { signal, untracked } from "@preact/signals";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { isSignal } from "../../utils/is_signal.js";
import { createJsValueWeakMap } from "../../utils/js_value_weak_map.js";

export const createRangeReader = (
  actionName,
  callback,
  {
    store,
    params: boundParams,
    invalidationSignal = signal(0),
    compositionSet = new Set(),
  },
) => {
  // Which composition this reader is about: the values its params hold, not its
  // own identity, so two `bindParams({ scope: "thread" })` made in two places
  // read and write the same one. There are as many compositions as there are
  // collections read through this reader — a handful, walked with the deep
  // comparison the rest of the codebase memoizes on.
  const currentParams = () => untracked(() => resolveParams(boundParams));
  const findComposition = (params) => {
    for (const composition of compositionSet) {
      if (compareTwoJsValues(composition.params, params)) {
        return composition;
      }
    }
    return null;
  };
  const readRange = async (range = {}) => {
    const { signal, ...rangeParams } = range;
    const paramsResolved = { ...resolveParams(boundParams), ...rangeParams };
    const result = await callback(paramsResolved, { signal });
    if (!result || !Array.isArray(result.items)) {
      throw new TypeError(
        `${actionName} must return { items, start, count }, received ${describeResult(result)}.`,
      );
    }
    const items = store.upsert(result.items);
    let { start, count } = result;
    if (start === undefined) {
      const startAsked = rangeParams.start;
      if (startAsked === undefined || startAsked < 0) {
        throw new TypeError(
          `${actionName} must say where the range lands (start), it was asked for ${describeRangeAsked(rangeParams)}.`,
        );
      }
      start = startAsked;
    }
    if (count === undefined) {
      count = start + items.length;
    }
    return { items, start, count };
  };
  Object.defineProperty(readRange, "name", { value: actionName });
  readRange.isRangeReader = true;
  // Bumped when the collection this reads has moved: the slices anyone holds
  // stand for a composition that is gone.
  readRange.invalidationSignal = invalidationSignal;
  readRange.invalidate = () => {
    compositionSet.clear();
    invalidationSignal.value = invalidationSignal.peek() + 1;
  };
  // The rows of a composition, drawn from the store: a rank whose row is gone
  // from the store resolves to nothing and is asked for again.
  readRange.readComposition = () => {
    const composition = findComposition(currentParams());
    if (!composition) {
      return null;
    }
    const byIndex = new Map();
    untracked(() => {
      for (const [index, id] of composition.idByIndex) {
        const item = store.select(id);
        if (item) {
          byIndex.set(index, item);
        }
      }
    });
    return { byIndex, count: composition.count };
  };
  // `replace` is a revalidation: the ranks that are not in what just came back
  // stood for a composition that has moved on. Otherwise the ranks are merged,
  // so two lists reading the same collection through their own windows add up
  // to one composition instead of taking turns erasing each other.
  readRange.writeComposition = ({ byIndex, count, replace }) => {
    const params = currentParams();
    let composition = findComposition(params);
    if (!composition) {
      composition = { params, idByIndex: new Map(), count };
      compositionSet.add(composition);
    } else if (replace) {
      composition.idByIndex = new Map();
    }
    composition.count = count;
    for (const [index, item] of byIndex) {
      const id = item ? item[store.idKey] : undefined;
      if (id !== undefined) {
        composition.idByIndex.set(index, id);
      }
    }
  };
  // The same trade a list makes with the rows it holds, applied to what is kept
  // for the next mount. Two lists on one collection each trim by their own
  // window; the rows a list is drawing stay on its screen regardless — a rank
  // dropped here is one that gets asked for again after a remount.
  readRange.trimComposition = (keepFrom, keepTo, budget) => {
    const composition = findComposition(currentParams());
    if (!composition || !budget || composition.idByIndex.size <= budget) {
      return;
    }
    for (const index of composition.idByIndex.keys()) {
      if (index < keepFrom || index > keepTo) {
        composition.idByIndex.delete(index);
      }
    }
  };
  // Memoized for the reasons an action's bindParams is (see actions.js): params
  // and the reader they make have synchronized lifetimes, and params equal in
  // value give back the reader that already exists instead of a second one.
  const readerByParams = createJsValueWeakMap();
  readRange.bindParams = (paramsToBind) => {
    const existing = readerByParams.get(paramsToBind);
    if (existing) {
      return existing;
    }
    const reader = createRangeReader(actionName, callback, {
      store,
      params: boundParams ? { ...boundParams, ...paramsToBind } : paramsToBind,
      invalidationSignal,
      compositionSet,
    });
    readerByParams.set(paramsToBind, reader);
    return reader;
  };
  return readRange;
};

// Params bound to a reader may be signals (the radar currently on screen); the
// value they hold when the range is asked for is the one the range is about.
const resolveParams = (params) => {
  if (!params) {
    return {};
  }
  const paramsResolved = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    paramsResolved[key] = isSignal(value) ? value.value : value;
  }
  return paramsResolved;
};

const describeResult = (result) => {
  if (Array.isArray(result)) {
    return `an array of ${result.length} item${result.length === 1 ? "" : "s"}`;
  }
  if (result && typeof result === "object") {
    return `an object holding ${Object.keys(result).join(", ") || "nothing"}`;
  }
  return `${result}`;
};

const describeRangeAsked = (rangeParams) => {
  const { start, limit, around, before, after } = rangeParams;
  if (around !== undefined) {
    return `the rows around "${around}"`;
  }
  if (before !== undefined) {
    return `the ${limit} rows before "${before}"`;
  }
  if (after !== undefined) {
    return `the ${limit} rows after "${after}"`;
  }
  if (start < 0) {
    return `the last ${limit} rows`;
  }
  return `${limit} rows from ${start}`;
};
