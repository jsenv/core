import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test(".one() links user to a session", async () => {
    const SESSION = resource("session");
    const USER = resource("user", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const USER_SESSION = USER.one("session", SESSION, {
      GET: async ({ id }) => ({
        id,
        session: { id: 10, userId: id, token: "abc123" },
      }),
    });

    await USER.POST({ name: "Alice" });
    const userBeforeSessionLoad = USER.store.arraySignal.value[0];

    await USER_SESSION.GET({ id: 1 });
    const userAfterSessionLoad = USER.store.arraySignal.value[0];
    const sessionStore = SESSION.store.arraySignal.value;

    return {
      userBeforeSessionLoad,
      userAfterSessionLoad,
      sessionStore,
    };
  });
});
