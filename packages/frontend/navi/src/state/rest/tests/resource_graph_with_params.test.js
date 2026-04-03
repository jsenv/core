import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("withParams binds params to actions", async () => {
    const receivedParams = [];
    const USER = resource("user", {
      GET_MANY: async (params) => {
        receivedParams.push({ ...params });
        return [
          { id: 1, name: "Alice", role: params.role },
          { id: 2, name: "Bob", role: params.role },
        ];
      },
      POST: async (params) => {
        receivedParams.push({ ...params });
        return { id: 3, name: params.name, role: params.role };
      },
    });

    const ADMIN_USER = USER.withParams({ role: "admin" });

    await ADMIN_USER.GET_MANY.run();
    const storeAfterGetMany = USER.store.arraySignal.value;

    await ADMIN_USER.POST({ name: "Charlie" });
    const storeAfterPost = USER.store.arraySignal.value;

    return { receivedParams, storeAfterGetMany, storeAfterPost };
  });

  test("two withParams instances share the same store", async () => {
    const USER = resource("user", {
      GET_MANY: async ({ role }) => {
        if (role === "admin") return [{ id: 1, name: "Alice", role }];
        return [{ id: 2, name: "Bob", role }];
      },
    });

    const ADMIN_USER = USER.withParams({ role: "admin" });
    const GUEST_USER = USER.withParams({ role: "guest" });

    await ADMIN_USER.GET_MANY.run();
    const storeAfterAdminLoad = USER.store.arraySignal.value;

    await GUEST_USER.GET_MANY.run();
    const storeAfterGuestLoad = USER.store.arraySignal.value;

    return { storeAfterAdminLoad, storeAfterGuestLoad };
  });
});
