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
});
