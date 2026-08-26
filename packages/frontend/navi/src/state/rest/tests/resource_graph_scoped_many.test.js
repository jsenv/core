import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("internalMany columns GET_MANY, POST and PATCH", async () => {
    const TABLE = resource("table", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      GET_MANY: async ({ id }) => [
        id,
        [
          { name: "id", type: "integer" },
          { name: "email", type: "varchar" },
        ],
      ],
      POST: async ({ id, name, type }) => [id, { name, type }],
      PATCH: async ({ id, name, type }) => [id, { name, type }],
    });

    await TABLE.POST({ name: "users" });
    const table = TABLE.store.arraySignal.value[0];
    const columnsBeforeLoad = [...table.columns];

    await TABLE_COLUMNS.GET_MANY({ id: 1 });
    const columnsAfterLoad = [...table.columns];

    await TABLE_COLUMNS.POST({ id: 1, name: "created_at", type: "timestamp" });
    const columnsAfterPost = [...table.columns];

    await TABLE_COLUMNS.PATCH({ id: 1, name: "email", type: "text" });
    const columnsAfterPatch = [...table.columns];

    return {
      columnsBeforeLoad,
      columnsAfterLoad,
      columnsAfterPost,
      columnsAfterPatch,
    };
  });

  test("GET_MANY data contains row objects not [ownerId, idArray]", async () => {
    const TABLE = resource("table", {
      idKey: "tableoid",
      uniqueKeys: ["tablename"],
      POST: async ({ tablename }) => ({ tableoid: 1, tablename }),
    });
    const TABLE_ROW = TABLE.scopedMany("rows", {
      idKey: "row_id",
      GET_MANY: async ({ tablename }) => [
        { tablename },
        [
          { row_id: 10, name: "Alice" },
          { row_id: 11, name: "Bob" },
        ],
      ],
    });

    await TABLE.POST({ tablename: "users" });

    const getManyResult = await TABLE_ROW.GET_MANY({ tablename: "users" });

    return { getManyResult };
  });

  test("internalMany columns id rename via PUT", async () => {
    const TABLE = resource("table", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      GET_MANY: async ({ id }) => [
        id,
        [
          { name: "id", type: "integer" },
          { name: "email", type: "varchar" },
        ],
      ],
      PUT: async ({ id, oldName, name, type }) => [id, oldName, { name, type }],
    });

    await TABLE.POST({ name: "users" });
    const table = TABLE.store.arraySignal.value[0];

    await TABLE_COLUMNS.GET_MANY({ id: 1 });
    const columnsBeforeRename = [...table.columns];

    // Rename "email" column to "email_address"
    await TABLE_COLUMNS.PUT({
      id: 1,
      oldName: "email",
      name: "email_address",
      type: "varchar",
    });
    const columnsAfterRename = [...table.columns];

    return { columnsBeforeRename, columnsAfterRename };
  });

  test("internalMany columns DELETE_MANY", async () => {
    const TABLE = resource("table", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      GET_MANY: async ({ id }) => [
        id,
        [
          { name: "id", type: "integer" },
          { name: "email", type: "varchar" },
          { name: "created_at", type: "timestamp" },
        ],
      ],
      DELETE_MANY: async ({ id, names }) => [id, names],
    });

    await TABLE.POST({ name: "users" });
    const table = TABLE.store.arraySignal.value[0];

    await TABLE_COLUMNS.GET_MANY({ id: 1 });
    const columnsBeforeDelete = [...table.columns];

    const deleteManyResult = await TABLE_COLUMNS.DELETE_MANY({
      id: 1,
      names: ["email", "created_at"],
    });
    const columnsAfterDelete = [...table.columns];

    return { columnsBeforeDelete, deleteManyResult, columnsAfterDelete };
  });

  test("rows fetched by tablename before the table is loaded", async () => {
    const TABLE = resource("table", {
      idKey: "tableoid",
      uniqueKeys: ["tablename"],
      POST: async ({ tablename }) => ({ tableoid: 1, tablename }),
    });
    const TABLE_ROW = TABLE.scopedMany("rows", {
      idKey: "row_id",
      GET_MANY: async ({ tablename }) => [
        { tablename },
        [
          { row_id: 10, name: "Alice" },
          { row_id: 11, name: "Bob" },
        ],
      ],
    });

    // The owner does not exist yet: the scope is created lazily, keyed by the
    // uniqueKey value returned by the callback.
    const rowsBeforeTableLoad = await TABLE_ROW.GET_MANY({
      tablename: "users",
    });

    // Loading the table must reuse that scope (found via the uniqueKey value).
    await TABLE.POST({ tablename: "users" });
    const table = TABLE.store.arraySignal.value[0];
    const tableRowsAfterTableLoad = [...table.rows];
    const scopeIsSharedBetweenIdAndUniqueKey =
      TABLE_ROW.getChildStore(1) === TABLE_ROW.getChildStore("users");

    return {
      rowsBeforeTableLoad,
      tableRowsAfterTableLoad,
      scopeIsSharedBetweenIdAndUniqueKey,
    };
  });

  test("chained .one() on scopedMany child items", async () => {
    const DATA_TYPE = resource("data_type", {
      PATCH: async ({ id, name }) => ({ id, name }),
    });
    const TABLE = resource("table", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      GET_MANY: async ({ id }) => [
        id,
        [
          { name: "id", dataType: { id: 1, name: "integer" } },
          { name: "email", dataType: { id: 2, name: "varchar" } },
        ],
      ],
    });
    TABLE_COLUMNS.one("dataType", DATA_TYPE);

    await TABLE.POST({ name: "users" });
    const table = TABLE.store.arraySignal.value[0];
    await TABLE_COLUMNS.GET_MANY({ id: 1 });

    const dataTypeStore = DATA_TYPE.store.arraySignal.value;
    const findEmailColumn = () =>
      table.columns.find((column) => column.name === "email");
    const emailDataType = { ...findEmailColumn().dataType };

    // updating the shared data_type resource propagates to the column property
    await DATA_TYPE.PATCH({ id: 2, name: "text" });
    const emailDataTypeAfterPatch = { ...findEmailColumn().dataType };

    return { dataTypeStore, emailDataType, emailDataTypeAfterPatch };
  });
});
