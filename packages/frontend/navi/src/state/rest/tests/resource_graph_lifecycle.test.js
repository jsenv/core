import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

const waitForRerun = () => new Promise((resolve) => setTimeout(resolve));

await snapshotTests(import.meta.url, ({ test }) => {
  // --- Basic lifecycle ----------------------------------------------------

  test("GET_MANY autoruns after POST", async () => {
    let getManyCallCount = 0;
    const USER = resource("user", {
      GET_MANY: async () => {
        getManyCallCount++;
        return [{ id: 1, name: "Alice" }];
      },
      POST: async ({ name }) => ({ id: 2, name }),
    });

    await USER.GET_MANY.run();
    const callCountAfterFirstLoad = getManyCallCount;

    await USER.POST({ name: "Bob" });
    await waitForRerun();

    return { callCountAfterFirstLoad, getManyCallCount };
  });

  test("GET_MANY derived via bindParams autoruns after POST", async () => {
    let getManyCallCount = 0;
    const USER = resource("user", {
      GET_MANY: async () => {
        getManyCallCount++;
        return [{ id: 1, name: "Alice" }];
      },
      POST: async ({ name }) => ({ id: 2, name }),
    });

    // Simulate what routeAction does: run GET_MANY through a bound derived instance
    const derivedGetMany = USER.GET_MANY.bindParams({});
    await derivedGetMany.run();
    const callCountAfterFirstLoad = getManyCallCount;

    await USER.POST({ name: "Bob" });
    await waitForRerun();

    return { callCountAfterFirstLoad, getManyCallCount };
  });

  test("GET_MANY does NOT rerun when PUT is called (default rerunOn)", async () => {
    let getManyCallCount = 0;
    const USER = resource("user", {
      GET_MANY: async () => {
        getManyCallCount++;
        return [{ id: 1, name: "Alice" }];
      },
      PUT: async ({ id, name }) => ({ id, name }),
    });

    await USER.GET_MANY.run();
    await USER.PUT({ id: 1, name: "Alice Updated" });
    await waitForRerun();

    return { getManyCallCount };
  });

  test("GET is reset when DELETE targets its id", async () => {
    const USER = resource("user", {
      GET: async ({ id }) => ({ id, name: "Alice" }),
      DELETE: async ({ id }) => id,
    });

    await USER.GET({ id: 1 });
    const stateAfterGet = {
      completed: USER.GET.bindParams({ id: 1 }).completed,
    };

    await USER.DELETE({ id: 1 });
    await waitForRerun();

    const stateAfterDelete = {
      completed: USER.GET.bindParams({ id: 1 }).completed,
    };

    return { stateAfterGet, stateAfterDelete };
  });

  test("GET for different id is not affected by DELETE", async () => {
    const USER = resource("user", {
      GET: async ({ id }) => ({ id, name: id === 1 ? "Alice" : "Bob" }),
      DELETE: async ({ id }) => id,
    });

    await USER.GET({ id: 1 });
    await USER.GET({ id: 2 });

    await USER.DELETE({ id: 1 });
    await waitForRerun();

    // id=2 GET should still be completed
    const id2Action = USER.GET.bindParams({ id: 2 });
    return { id2Completed: id2Action.completed };
  });

  // --- Param scope isolation ------------------------------------------------

  test("POST with params only reruns GET_MANY with same params", async () => {
    const callLog = [];
    const USER = resource("user", {
      GET_MANY: async ({ role }) => {
        callLog.push(`GET_MANY role=${role}`);
        return [{ id: 1, name: "Alice", role }];
      },
      POST: async ({ name, role }) => ({ id: 2, name, role }),
    });

    const ADMIN = USER.withParams({ role: "admin" });
    const GUEST = USER.withParams({ role: "guest" });

    await ADMIN.GET_MANY.run();
    await GUEST.GET_MANY.run();
    const callLogAfterInitialLoad = [...callLog];

    // POST from ADMIN scope — should only rerun ADMIN's GET_MANY
    await ADMIN.POST({ name: "Bob" });
    await waitForRerun();

    return { callLogAfterInitialLoad, callLogAfterPost: [...callLog] };
  });

  test("POST without params reruns all GET_MANY", async () => {
    const callLog = [];
    const USER = resource("user", {
      GET_MANY: async ({ role } = {}) => {
        callLog.push(`GET_MANY role=${role}`);
        return [{ id: 1, name: "Alice" }];
      },
      POST: async ({ name }) => ({ id: 2, name }),
    });

    const ADMIN = USER.withParams({ role: "admin" });
    const GUEST = USER.withParams({ role: "guest" });

    // Load both parameterized lists
    await ADMIN.GET_MANY.run();
    await GUEST.GET_MANY.run();
    const callLogAfterInitialLoad = [...callLog];

    // POST from root resource (no params) — should rerun all GET_MANY
    await USER.POST({ name: "Bob" });
    await waitForRerun();

    return { callLogAfterInitialLoad, callLogAfterPost: [...callLog] };
  });
});
