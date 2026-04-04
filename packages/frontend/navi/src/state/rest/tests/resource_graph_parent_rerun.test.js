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
});
