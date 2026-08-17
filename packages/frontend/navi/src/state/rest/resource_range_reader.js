/*
 * GET_RANGE: reading a resource one slice at a time, for a list that draws its
 * rows as it goes (`<List.Items itemsAction>`).
 *
 * It is on purpose not an action. An action keeps the one response it got and
 * replays it, and takes a place in the rerun graph — two things a slice must
 * not do: the list already holds the slices it received and glues them back
 * together, and a mutation would otherwise send every slice ever loaded back to
 * the network at once. So the reader keeps nothing. It runs the callback with
 * the range the list asks for, writes what comes back into the store, and hands
 * the rows back as store items — never a copy of the JSON, so the relations a
 * row reads are the shared ones and a request sent from a row is read back on
 * it. A row following its own fields through a write reads them from the store
 * (`RESOURCE.useById(id)`): an update replaces the item object, and the one the
 * list is holding is the one it was given.
 *
 * The reader is a function, so a list feeds on it the way it feeds on any other
 * source: `itemsAction={GAME.GET_RANGE.bindParams({ radar })}`.
 */

import { isSignal } from "../../utils/is_signal.js";

export const createRangeReader = (
  actionName,
  callback,
  { store, params: boundParams },
) => {
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
  readRange.bindParams = (paramsToBind) => {
    return createRangeReader(actionName, callback, {
      store,
      params: boundParams ? { ...boundParams, ...paramsToBind } : paramsToBind,
    });
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
