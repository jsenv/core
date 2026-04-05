import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

const waitForRerun = () => new Promise((resolve) => setTimeout(resolve));

await snapshotTests(import.meta.url, ({ test }) => {
  // --- scopedMany: parent GET reruns on child POST --------------------------

  test("scopedMany: parent GET reruns after child POST", async () => {
    let getCallCount = 0;
    const TABLE = resource("table", {
      GET: async ({ id }) => {
        getCallCount++;
        return { id, columns: [] };
      },
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      POST: async ({ id, name }) => [id, { name }],
    });

    const tableAction = TABLE.GET.bindParams({ id: 1 });
    await tableAction.run();
    const callCountAfterGet = getCallCount;

    await TABLE_COLUMNS.POST({ id: 1, name: "email" });
    await waitForRerun();

    return { callCountAfterGet, getCallCount };
  });

  test("scopedMany: parent GET does NOT rerun after child PUT", async () => {
    let getCallCount = 0;
    const TABLE = resource("table", {
      GET: async ({ id }) => {
        getCallCount++;
        return { id, columns: [{ name: "email" }] };
      },
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      PUT: async ({ id, oldName, name }) => [id, oldName, { name }],
    });

    const tableAction = TABLE.GET.bindParams({ id: 1 });
    await tableAction.run();
    const callCountAfterGet = getCallCount;

    await TABLE_COLUMNS.PUT({ id: 1, oldName: "email", name: "email_address" });
    await waitForRerun();

    return { callCountAfterGet, getCallCount };
  });

  test("scopedMany: parent GET does NOT rerun after child PATCH", async () => {
    let getCallCount = 0;
    const TABLE = resource("table", {
      GET: async ({ id }) => {
        getCallCount++;
        return { id, columns: [{ name: "email", type: "varchar" }] };
      },
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      PATCH: async ({ id, name, type }) => [id, { name, type }],
    });

    const tableAction = TABLE.GET.bindParams({ id: 1 });
    await tableAction.run();
    const callCountAfterGet = getCallCount;

    await TABLE_COLUMNS.PATCH({ id: 1, name: "email", type: "text" });
    await waitForRerun();

    return { callCountAfterGet, getCallCount };
  });

  test("scopedMany: parent GET is not reset after child DELETE", async () => {
    let getCallCount = 0;
    const TABLE = resource("table", {
      GET: async ({ id }) => {
        getCallCount++;
        return { id, columns: [{ name: "email" }] };
      },
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      DELETE: async ({ id, name }) => [id, name],
    });

    const tableAction = TABLE.GET.bindParams({ id: 1 });
    await tableAction.run();
    const completedBeforeDelete = tableAction.completed;
    const callCountAfterGet = getCallCount;

    await TABLE_COLUMNS.DELETE({ id: 1, name: "email" });
    await waitForRerun();

    return {
      callCountAfterGet,
      getCallCount,
      completedBeforeDelete,
      completedAfterDelete: tableAction.completed,
    };
  });

  // --- scopedMany: parent GET_MANY not re-run by child POST -----------------

  test("scopedMany: parent GET_MANY does not rerun after child POST", async () => {
    let getManyCallCount = 0;
    const TABLE = resource("table", {
      GET_MANY: async () => {
        getManyCallCount++;
        return [{ id: 1, columns: [] }];
      },
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      POST: async ({ id, name }) => [id, { name }],
    });

    await TABLE.GET_MANY.run();
    const callCountAfterGetMany = getManyCallCount;

    await TABLE_COLUMNS.POST({ id: 1, name: "email" });
    await waitForRerun();

    return { callCountAfterGetMany, getManyCallCount };
  });

  // --- scopedOne: parent GET does NOT rerun on child POST -------------------

  test("scopedOne: parent GET does NOT rerun after child POST", async () => {
    let getCallCount = 0;
    const USER = resource("user", {
      GET: async ({ id }) => {
        getCallCount++;
        return { id, profile: null };
      },
    });
    const USER_PROFILE = USER.scopedOne("profile", {
      POST: async ({ id, bio }) => [id, { bio }],
    });

    const userAction = USER.GET.bindParams({ id: 1 });
    await userAction.run();
    const callCountAfterGet = getCallCount;

    await USER_PROFILE.POST({ id: 1, bio: "Hello" });
    await waitForRerun();

    return { callCountAfterGet, getCallCount };
  });

  // --- Never-run actions are not triggered ----------------------------------

  test("GET_MANY that never ran is not called after POST", async () => {
    let getManyCallCount = 0;
    const USER = resource("user", {
      GET_MANY: async () => {
        getManyCallCount++;
        return [{ id: 1, name: "Alice" }];
      },
      POST: async ({ name }) => ({ id: 2, name }),
    });

    // Intentionally do NOT run GET_MANY
    await USER.POST({ name: "Bob" });
    await waitForRerun();

    return { getManyCallCount };
  });

  test("GET that never ran is not called after scopedMany child POST", async () => {
    let getCallCount = 0;
    const TABLE = resource("table", {
      GET: async ({ id }) => {
        getCallCount++;
        return { id, columns: [] };
      },
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const TABLE_COLUMNS = TABLE.scopedMany("columns", {
      idKey: "name",
      POST: async ({ id, name }) => [id, { name }],
    });

    // Create the parent item so the child store exists, but do NOT run TABLE.GET
    await TABLE.POST({ name: "users" });
    await TABLE_COLUMNS.POST({ id: 1, name: "email" });
    await waitForRerun();

    return { getCallCount };
  });

  test("GET_MANY that never ran is not called after dependency POST", async () => {
    let getManyCallCount = 0;
    const OWNER = resource("owner", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    resource("dependent", {
      GET_MANY: async () => {
        getManyCallCount++;
        return [];
      },
      dependencies: [OWNER],
    });

    // Intentionally do NOT run DEPENDENT.GET_MANY
    await OWNER.POST({ name: "test" });
    await waitForRerun();

    return { getManyCallCount };
  });

  // --- scopedMany with dependencies: sibling rerun on column rename ---------

  test("scopedMany with dependencies reruns GET_MANY after sibling column PUT", async () => {
    const db = {
      tables: {
        users: {
          tableoid: 1,
          columns: [{ column_name: "email" }],
          rows: [{ row_id: 1, email: "email_value" }],
        },
      },
    };

    let nextTableoid = 1;
    const TABLE = resource("table", {
      idKey: "tableoid",
      uniqueKeys: ["tablename"],
      GET: ({ tablename }) => ({
        tableoid: nextTableoid++,
        tablename,
        columns: db.tables[tablename].columns,
      }),
    });
    const TABLE_COLUMN = TABLE.scopedMany("columns", {
      idKey: "column_name",
      PUT: ({ tablename, column_name, property, value }) => {
        const table = db.tables[tablename];
        const column = table.columns.find((c) => c.column_name === column_name);
        const oldValue = column[property];
        column[property] = value;
        if (property === "column_name") {
          for (const row of table.rows) {
            row[value] = row[oldValue];
            delete row[oldValue];
          }
        }
        return [{ tablename }, { column_name }, { [property]: value }];
      },
    });
    const TABLE_ROW = TABLE.scopedMany("rows", {
      idKey: "row_id",
      dependencies: [TABLE_COLUMN],
      GET_MANY: ({ tablename }) => {
        return [{ tablename }, db.tables[tablename].rows];
      },
    });

    const rowsAction = TABLE_ROW.GET_MANY.bindParams({ tablename: "users" });

    TABLE.GET({ tablename: "users" });
    await rowsAction.run();
    const rowsBeforeRename = rowsAction.data.map((r) => ({ ...r }));

    TABLE_COLUMN.PUT({
      tablename: "users",
      column_name: "email",
      property: "column_name",
      value: "email_address",
    });
    await waitForRerun();
    const rowsAfterRename = rowsAction.data.map((r) => ({ ...r }));

    return { rowsBeforeRename, rowsAfterRename };
  });
});
