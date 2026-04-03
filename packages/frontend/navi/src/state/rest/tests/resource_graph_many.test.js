import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("GET_MANY dataSignal updates when an item in the list is updated", async () => {
    const USER = resource("user", {
      GET_MANY: async () => [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      PATCH: async ({ id, name }) => ({ id, name }),
    });

    await USER.GET_MANY.run();
    const dataAfterGetMany = USER.GET_MANY.dataSignal.value;

    await USER.PATCH({ id: 1, name: "Alice Updated" });
    const dataAfterPatch = USER.GET_MANY.dataSignal.value;

    return { dataAfterGetMany, dataAfterPatch };
  });

  test("GET_MANY dataSignal tracks id rename after PUT", async () => {
    const USER = resource("user", {
      uniqueKeys: ["username"],
      GET_MANY: async () => [
        { id: 1, username: "alice", name: "Alice" },
        { id: 2, username: "bob", name: "Bob" },
      ],
      PUT: async ({ username, prop, value }) => [
        { username },
        { [prop]: value },
      ],
    });

    await USER.GET_MANY.run();
    const dataAfterGetMany = USER.GET_MANY.dataSignal.value;

    // Change alice's id from 1 to 99 — GET_MANY dataSignal should still include her with the new id
    await USER.PUT({
      username: "alice",
      prop: "username",
      value: "Alice Renamed",
    });
    const dataAfterPut = USER.GET_MANY.dataSignal.value;

    return { dataAfterGetMany, dataAfterPut };
  });
});
