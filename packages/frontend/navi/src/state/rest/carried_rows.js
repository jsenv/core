/*
 * `carries`: which objects of an answer are rows of a resource. Declared on an
 * action (createAction's `carries`, read over each answer it lands with) or on
 * a resource (resource()'s `carries`, read over each of its rows, as a
 * relation reads its property), every object found at a path is written into
 * that resource's store. The answer keeps the object as it came.
 *
 * No facade in place of the object, unlike `.one()`: a facade reads an empty
 * object, truthy, where the answer said `null`, and every `club.place ? …` of
 * an app drawing a composite answer would have to learn it. The row the store
 * holds is a `useById(object.id)` away.
 *
 * Kept alive as a relation's child is: a write outside a range answer pins
 * the row (see `pinned` in array_signal_store.js), which is every answer an
 * action lands with — so an action holds nothing and lets go of nothing. A
 * resource's row may come from a range answer, so it holds what it carries,
 * as `.one()` holds its child, and lets go of it when it carries something
 * else or leaves its store.
 */

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

const EACH = {};

/**
 * @param {Object} carries - `{ [path]: resource }`
 * @param {string} label - who declared it, for errors and warnings
 * @param {{ fromRow?: boolean }} [options] - `fromRow`: the paths start at a
 *   row's property (resource()'s `carries`), never at the answer itself
 * @returns {Array<{ path: string, steps: Array, resource: Object, warned: boolean }>}
 */
export const parseCarries = (carries, label, { fromRow = false } = {}) => {
  if (carries === null || typeof carries !== "object") {
    throw new TypeError(
      `${label}: carries must be an object of { path: resource }, got ${carries}`,
    );
  }
  const carriedArray = [];
  for (const path of Object.keys(carries)) {
    const resource = carries[path];
    if (!resource || !resource.store || typeof resource.idKey !== "string") {
      throw new TypeError(
        `${label}: carries["${path}"] must be a resource (made by resource()), got ${resource}`,
      );
    }
    const steps = parseCarriedPath(path, label);
    if (fromRow && steps[0] === EACH) {
      throw new TypeError(
        `${label}: carries["${path}"] starts at the row, which is an object: begin the path with one of its properties`,
      );
    }
    carriedArray.push({ path, steps, resource, warned: false });
  }
  return carriedArray;
};

// "clubs[].place": a property, `[]` for each entry of an array, `.` between.
// A path may start with `[]` (an answer that is an array), and may end on
// `[]` (the entries are the rows).
const PATH_SEGMENT_REGEX = /^([^.[\]]*)((?:\[\])*)$/;
const parseCarriedPath = (path, label) => {
  const steps = [];
  const segments = path.split(".");
  for (let i = 0; i < segments.length; i++) {
    const match = PATH_SEGMENT_REGEX.exec(segments[i]);
    const key = match ? match[1] : "";
    const eachCount = match ? match[2].length / 2 : 0;
    if (!match || (key === "" && (i > 0 || eachCount === 0))) {
      throw new TypeError(
        `${label}: carries["${path}"] is not a path: write properties joined by "." and "[]" after an array ("clubs[].place", "[].owner")`,
      );
    }
    if (key) {
      steps.push(key);
    }
    for (let j = 0; j < eachCount; j++) {
      steps.push(EACH);
    }
  }
  return steps;
};

/**
 * Writes the rows `value` carries at each path into their store.
 * @returns {Array<Array<any>>} the ids written, per entry of `carriedArray`
 */
export const writeCarriedRows = (carriedArray, value, { answer, label }) => {
  const idsArray = [];
  for (const carried of carriedArray) {
    const { resource } = carried;
    const { store, idKey } = resource;
    const ids = [];
    collectCarried(
      value,
      carried.steps,
      0,
      (object) => {
        if (object === null || object === undefined) {
          return;
        }
        if (typeof object !== "object" || Array.isArray(object)) {
          warnBrokenContract(
            carried,
            label,
            `a "${resource.name}" row`,
            object,
          );
          return;
        }
        if (object[idKey] === undefined) {
          warnBrokenContract(
            carried,
            label,
            `a "${resource.name}" row, with its "${idKey}"`,
            object,
          );
          return;
        }
        const row = answer ? store.upsertAnswer(object) : store.upsert(object);
        ids.push(row[idKey]);
      },
      (expected, received) => {
        warnBrokenContract(carried, label, expected, received);
      },
    );
    idsArray.push(ids);
  }
  return idsArray;
};

// `null` or `undefined` on the way is an answer saying "nothing here"; any
// other shape than the path names is the server breaking it.
const collectCarried = (value, steps, index, onRow, onMismatch) => {
  if (index === steps.length) {
    onRow(value);
    return;
  }
  if (value === null || value === undefined) {
    return;
  }
  const step = steps[index];
  if (step === EACH) {
    if (!Array.isArray(value)) {
      onMismatch("an array", value);
      return;
    }
    for (const entry of value) {
      collectCarried(entry, steps, index + 1, onRow, onMismatch);
    }
    return;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    onMismatch(`an object with "${step}"`, value);
    return;
  }
  collectCarried(value[step], steps, index + 1, onRow, onMismatch);
};

// Once per path: an answer breaking the contract breaks it for every row.
const warnBrokenContract = (carried, label, expected, received) => {
  if (!import.meta.dev || carried.warned) {
    return;
  }
  carried.warned = true;
  console.warn(
    `${label}: carries["${carried.path}"] expects ${expected} there, got ${describe(received)}; it is skipped (and warned once).`,
  );
};
const describe = (value) => {
  if (Array.isArray(value)) {
    return "an array";
  }
  if (value !== null && typeof value === "object") {
    return `{ ${Object.keys(value).join(", ")} }`;
  }
  return String(value);
};

/**
 * Sets up, on a resource's row, the properties its `carries` paths start
 * with: each is read as the plain value it holds, and writing it writes the
 * rows found under it into their stores and holds them there.
 * Called from the row's item setup, so the copies a write makes of the row
 * share what it holds (see setUpItem in resource_graph.js).
 * @returns {() => void} lets go of every row it holds
 */
export const setUpCarryingProperties = (
  item,
  carriedByKey,
  { answer, label },
) => {
  const leaveArray = [];
  for (const [key, carriedArray] of carriedByKey) {
    leaveArray.push(
      setUpCarryingProperty(item, key, carriedArray, { answer, label }),
    );
  }
  return () => {
    for (const leave of leaveArray) {
      leave();
    }
  };
};
export const groupCarriesByKey = (carriedArray) => {
  const carriedByKey = new Map();
  for (const carried of carriedArray) {
    const [key] = carried.steps;
    const carriedRest = { ...carried, steps: carried.steps.slice(1) };
    const group = carriedByKey.get(key);
    if (group) {
      group.push(carriedRest);
    } else {
      carriedByKey.set(key, [carriedRest]);
    }
  }
  return carriedByKey;
};

const setUpCarryingProperty = (item, key, carriedArray, { answer, label }) => {
  // The value lives on each copy of the row, as a data property does: the
  // copy a write makes holds the new value, the row it replaced the old one.
  const valueSymbol = Symbol(`carrying ${key}`);
  let heldIdsArray = carriedArray.map(() => []);
  const carry = (value, answer) => {
    const idsArray = writeCarriedRows(carriedArray, value, { answer, label });
    // The rows of this write are held before those of the previous one are
    // let go of: a row in both never counts as let go of.
    for (let i = 0; i < carriedArray.length; i++) {
      const { store } = carriedArray[i].resource;
      for (const id of idsArray[i]) {
        store.hold(id);
      }
      for (const id of heldIdsArray[i]) {
        store.release(id);
      }
    }
    heldIdsArray = idsArray;
  };
  const initialValue = item[key];
  carry(initialValue, answer);
  Object.defineProperty(item, valueSymbol, {
    value: initialValue,
    writable: true,
  });
  Object.defineProperty(item, key, {
    enumerable: true,
    get() {
      return this[valueSymbol];
    },
    // Called by the store's write with `answer`, which reads what it returns
    // (see assign in array_signal_store.js): the rows are written on every
    // write, the server's word being the latest, and the row counts as
    // written only when the value moved, compared as that write compares.
    /* eslint-disable no-setter-return -- the store's write reads it, as it reads a relation's setter */
    set(value, answer) {
      carry(value, answer);
      const valueBefore = this[valueSymbol];
      if (value === valueBefore) {
        return false;
      }
      if (answer && compareTwoJsValues(value, valueBefore)) {
        return false;
      }
      this[valueSymbol] = value;
      return true;
    },
    /* eslint-enable no-setter-return */
  });
  return () => {
    for (let i = 0; i < carriedArray.length; i++) {
      const { store } = carriedArray[i].resource;
      for (const id of heldIdsArray[i]) {
        store.release(id);
      }
    }
    heldIdsArray = carriedArray.map(() => []);
  };
};
