import { snapshotTests } from "@jsenv/snapshot";
import { createColumnOrdering } from "../use_ordered_columns.js";

// Helper: build a set of columns from an array of id strings
const cols = (ids) => ids.map((id) => ({ id }));

// Helper: run sync and return the ordered ids
const syncIds = (ordering, columns, orderedColumnIds) =>
  ordering.sync(columns, orderedColumnIds).map((col) => col.id);

await snapshotTests(import.meta.url, ({ test }) => {
  // ─── Initial render ────────────────────────────────────────────────────────

  test("first sync: returns columns in source order", () => {
    const ordering = createColumnOrdering("id", () => {});
    const columns = cols(["a", "b", "c"]);
    return { result: syncIds(ordering, columns, ["a", "b", "c"]) };
  });

  test("first sync: respects user-provided initial order", () => {
    const ordering = createColumnOrdering("id", () => {});
    const columns = cols(["a", "b", "c"]);
    return { result: syncIds(ordering, columns, ["c", "b", "a"]) };
  });

  test("first sync: empty column list", () => {
    const ordering = createColumnOrdering("id", () => {});
    return { result: syncIds(ordering, [], []) };
  });

  // ─── No changes ────────────────────────────────────────────────────────────

  test("second sync with identical columns: order unchanged", () => {
    const ordering = createColumnOrdering("id", () => {});
    const columns = cols(["a", "b", "c"]);
    syncIds(ordering, columns, ["a", "b", "c"]);
    return { result: syncIds(ordering, columns, ["c", "b", "a"]) };
  });

  // ─── Addition ──────────────────────────────────────────────────────────────

  test("add column at end: appended after last existing neighbor", () => {
    const ordering = createColumnOrdering("id", () => {});
    const columns = cols(["a", "b", "c"]);
    syncIds(ordering, columns, ["a", "b", "c"]);
    const newColumns = cols(["a", "b", "c", "d"]);
    return { result: syncIds(ordering, newColumns, ["a", "b", "c"]) };
  });

  test("add column in middle: inserted after its left neighbor in source", () => {
    // source: A, B, Z, C  — user order was C, B, A — Z should go after B
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b", "c"]), ["c", "b", "a"]);
    return {
      result: syncIds(ordering, cols(["a", "b", "z", "c"]), ["c", "b", "a"]),
    };
  });

  test("add column at start: prepended when no left neighbor exists", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["b", "c"]), ["b", "c"]);
    return { result: syncIds(ordering, cols(["a", "b", "c"]), ["b", "c"]) };
  });

  test("add multiple columns at once", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["b"]), ["b"]);
    return { result: syncIds(ordering, cols(["a", "b", "c"]), ["b"]) };
  });

  // ─── Removal ───────────────────────────────────────────────────────────────

  test("remove column from middle: dropped from order", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b", "c"]), ["a", "b", "c"]);
    return { result: syncIds(ordering, cols(["a", "c"]), ["a", "b", "c"]) };
  });

  test("remove column from end", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b", "c"]), ["a", "b", "c"]);
    return { result: syncIds(ordering, cols(["a", "b"]), ["a", "b", "c"]) };
  });

  test("remove all columns", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b", "c"]), ["a", "b", "c"]);
    return { result: syncIds(ordering, [], ["a", "b", "c"]) };
  });

  test("remove column that was first in user order", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b", "c"]), ["c", "b", "a"]);
    return { result: syncIds(ordering, cols(["a", "b"]), ["c", "b", "a"]) };
  });

  // ─── Rename ────────────────────────────────────────────────────────────────

  test("rename: column keeps its position in user order", () => {
    const setCalls = [];
    const ordering = createColumnOrdering("id", (ids) => setCalls.push(ids));
    syncIds(ordering, cols(["a", "b", "c"]), ["c", "b", "a"]);
    // rename "b" → "beta"
    const result = syncIds(ordering, cols(["a", "beta", "c"]), ["c", "b", "a"]);
    return { result, setCalledWith: setCalls };
  });

  test("rename first column in user order", () => {
    const setCalls = [];
    const ordering = createColumnOrdering("id", (ids) => setCalls.push(ids));
    syncIds(ordering, cols(["a", "b", "c"]), ["c", "b", "a"]);
    const result = syncIds(ordering, cols(["alpha", "b", "c"]), [
      "c",
      "b",
      "a",
    ]);
    return { result, setCalledWith: setCalls };
  });

  test("rename does not trigger setOrderedColumnIds when not needed on next render", () => {
    const setCalls = [];
    const ordering = createColumnOrdering("id", (ids) => setCalls.push(ids));
    syncIds(ordering, cols(["a", "b", "c"]), ["a", "b", "c"]);
    // rename render — updates state
    syncIds(ordering, cols(["a", "beta", "c"]), ["a", "b", "c"]);
    const callCountAfterRename = setCalls.length;
    // next render with already-updated ids — should not call setter again
    syncIds(ordering, cols(["a", "beta", "c"]), ["a", "beta", "c"]);
    return { callCountAfterRename, totalCalls: setCalls.length };
  });

  // ─── Mixed operations ──────────────────────────────────────────────────────

  test("rename and add in the same sync", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b", "c"]), ["a", "b", "c"]);
    // rename "a" → "alpha", add "d" at end
    return {
      result: syncIds(ordering, cols(["alpha", "b", "c", "d"]), [
        "a",
        "b",
        "c",
      ]),
    };
  });

  test("rename and remove in the same sync", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b", "c"]), ["a", "b", "c"]);
    // rename "a" → "alpha", remove "c"
    return {
      result: syncIds(ordering, cols(["alpha", "b"]), ["a", "b", "c"]),
    };
  });

  test("remove and add different column in same sync (not a rename)", () => {
    // When counts differ, extras are treated as pure add/remove, not renames.
    // remove "c", add "d" and "e" — "c" is paired as rename to "d", "e" is pure add
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b", "c"]), ["a", "b", "c"]);
    return {
      result: syncIds(ordering, cols(["a", "b", "d", "e"]), ["a", "b", "c"]),
    };
  });

  // ─── Custom columnIdKey ────────────────────────────────────────────────────

  test("custom columnIdKey: works with 'name' property", () => {
    const ordering = createColumnOrdering("name", () => {});
    const columns = [{ name: "first" }, { name: "second" }, { name: "third" }];
    const order = ["third", "second", "first"];
    const sync = (cols, ids) => ordering.sync(cols, ids).map((col) => col.name);
    sync(columns, order);
    // rename "second" → "middle"
    const newColumns = [
      { name: "first" },
      { name: "middle" },
      { name: "third" },
    ];
    return { result: sync(newColumns, order) };
  });

  // ─── Edge cases ────────────────────────────────────────────────────────────

  test("single column: rename works", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a"]), ["a"]);
    return { result: syncIds(ordering, cols(["alpha"]), ["a"]) };
  });

  test("add then remove the same column across two syncs", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b"]), ["a", "b"]);
    syncIds(ordering, cols(["a", "b", "c"]), ["a", "b"]);
    return { result: syncIds(ordering, cols(["a", "b"]), ["a", "b", "c"]) };
  });

  test("user order with unknown id is dropped", () => {
    const ordering = createColumnOrdering("id", () => {});
    syncIds(ordering, cols(["a", "b"]), ["a", "b"]);
    // orderedColumnIds contains "ghost" which no longer exists in columns
    return {
      result: syncIds(ordering, cols(["a", "b"]), ["a", "ghost", "b"]),
    };
  });
});
