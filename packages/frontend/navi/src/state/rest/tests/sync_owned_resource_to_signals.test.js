import { snapshotTests } from "@jsenv/snapshot";
import { signal } from "@preact/signals";
import {
  resource,
  syncOwnedResourceToSignals,
  syncResourceToSignals,
} from "../resource_graph.js";

const createTableResources = (initialTables = {}) => {
  let nextTableoid = 1;
  const tableoidByName = {};
  const getTableoid = (tablename) => {
    if (!tableoidByName[tablename]) {
      tableoidByName[tablename] = nextTableoid++;
    }
    return tableoidByName[tablename];
  };
  const TABLE = resource("table", {
    idKey: "tableoid",
    uniqueKeys: ["tablename"],
    GET: ({ tablename }) => {
      const columns = initialTables[tablename];
      if (!columns) return null;
      return {
        tableoid: getTableoid(tablename),
        tablename,
        columns: columns.map((column_name) => ({ column_name })),
      };
    },
    POST: ({ tablename }) => ({ tableoid: getTableoid(tablename), tablename }),
  });
  const TABLE_COLUMN = TABLE.scopedMany("columns", {
    idKey: "column_name",
    POST: ({ tablename, column_name }) => [{ tablename }, { column_name }],
    PUT: ({ tablename, column_name, property, value }) => [
      { tablename },
      { column_name },
      { [property]: value },
    ],
  });
  return { TABLE, TABLE_COLUMN };
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("GET loads table and column, PUT rename updates signal", () => {
    const { TABLE, TABLE_COLUMN } = createTableResources({
      users: ["email"],
    });

    TABLE.GET({ tablename: "users" });

    const tablenameSignal = signal("users");
    const columnNameSignal = signal("email");
    syncOwnedResourceToSignals(TABLE_COLUMN, tablenameSignal, {
      column_name: columnNameSignal,
    });

    const signalBeforeRename = columnNameSignal.value;

    TABLE_COLUMN.PUT({
      tablename: "users",
      column_name: "email",
      property: "column_name",
      value: "email_address",
    });
    const signalAfterRename = columnNameSignal.value;

    return { signalBeforeRename, signalAfterRename };
  });

  test("updates signal when child idKey property changes", () => {
    const { TABLE, TABLE_COLUMN } = createTableResources();

    TABLE.POST({ tablename: "users" });

    const tablenameSignal = signal("users");
    const columnNameSignal = signal("email");
    syncOwnedResourceToSignals(TABLE_COLUMN, tablenameSignal, {
      column_name: columnNameSignal,
    });

    TABLE_COLUMN.POST({ tablename: "users", column_name: "email" });
    const signalBeforeRename = columnNameSignal.value;

    TABLE_COLUMN.PUT({
      tablename: "users",
      column_name: "email",
      property: "column_name",
      value: "email_address",
    });
    const signalAfterRename = columnNameSignal.value;

    return { signalBeforeRename, signalAfterRename };
  });

  test("switches child store when ownerSignal changes", () => {
    const { TABLE, TABLE_COLUMN } = createTableResources();

    TABLE.POST({ tablename: "users" });
    TABLE.POST({ tablename: "orders" });

    const tablenameSignal = signal("users");
    const columnNameSignal = signal("email");
    syncOwnedResourceToSignals(TABLE_COLUMN, tablenameSignal, {
      column_name: columnNameSignal,
    });

    // Rename "email" in users table — signal should update
    TABLE_COLUMN.POST({ tablename: "users", column_name: "email" });
    TABLE_COLUMN.PUT({
      tablename: "users",
      column_name: "email",
      property: "column_name",
      value: "email_address",
    });
    const afterUsersRename = columnNameSignal.value;

    // Switch owner to orders — signal now tracks orders columns
    tablenameSignal.value = "orders";
    columnNameSignal.value = "total";
    TABLE_COLUMN.POST({ tablename: "orders", column_name: "total" });

    TABLE_COLUMN.PUT({
      tablename: "orders",
      column_name: "total",
      property: "column_name",
      value: "total_amount",
    });
    const afterOrdersRename = columnNameSignal.value;

    return { afterUsersRename, afterOrdersRename };
  });

  test("does not update signal when a column in a different table changes", () => {
    const { TABLE, TABLE_COLUMN } = createTableResources();

    TABLE.POST({ tablename: "users" });
    TABLE.POST({ tablename: "orders" });

    const tablenameSignal = signal("users");
    const columnNameSignal = signal("email");
    syncOwnedResourceToSignals(TABLE_COLUMN, tablenameSignal, {
      column_name: columnNameSignal,
    });

    TABLE_COLUMN.POST({ tablename: "users", column_name: "email" });

    // Rename a column in "orders" — signal is tracking "users"
    TABLE_COLUMN.POST({ tablename: "orders", column_name: "total" });
    TABLE_COLUMN.PUT({
      tablename: "orders",
      column_name: "total",
      porperty: "column_name",
      value: "total_amount",
    });
    const signalAfterOtherTableRename = columnNameSignal.value;

    return { signalAfterOtherTableRename };
  });

  test("throws when called on a non-scoped resource", () => {
    const USER = resource("user", {
      idKey: "id",
      uniqueKeys: ["username"],
    });

    const ownerSignal = signal("whatever");
    const someSignal = signal("value");
    let error = null;
    try {
      syncOwnedResourceToSignals(USER, ownerSignal, {
        username: someSignal,
      });
    } catch (e) {
      error = e.message;
    }

    return { error };
  });

  test("throws when syncResourceToSignals is called on a scoped resource", () => {
    const TABLE = resource("table", {
      idKey: "tableoid",
      uniqueKeys: ["tablename"],
    });
    const TABLE_COLUMN = TABLE.scopedMany("columns", {
      idKey: "column_name",
    });

    const someSignal = signal("value");
    let error = null;
    try {
      syncResourceToSignals(TABLE_COLUMN, { column_name: someSignal });
    } catch (e) {
      error = e.message;
    }

    return { error };
  });

  test("does nothing when ownerSignal is null", () => {
    const { TABLE, TABLE_COLUMN } = createTableResources();

    TABLE.POST({ tablename: "users" });
    TABLE_COLUMN.POST({ tablename: "users", column_name: "email" });

    const tablenameSignal = signal(null);
    const columnNameSignal = signal("email");
    syncOwnedResourceToSignals(TABLE_COLUMN, tablenameSignal, {
      column_name: columnNameSignal,
    });

    TABLE_COLUMN.PUT({
      tablename: "users",
      column_name: "email",
      property: "column_name",
      value: "email_address",
    });
    const signalAfterRename = columnNameSignal.value;

    return { signalAfterRename };
  });
});
