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
    const captureFirstUser = () => ({ ...USER.store.arraySignal.value[0] });

    await USER.POST({ name: "Alice" });
    const userBeforeSessionLoad = captureFirstUser();

    await USER_SESSION.GET({ id: 1 });
    const userAfterSessionLoad = captureFirstUser();
    const sessionStore = SESSION.store.arraySignal.value;

    return {
      userBeforeSessionLoad,
      userAfterSessionLoad,
      sessionStore,
    };
  });

  test(".one() session populated from user GET response", async () => {
    const SESSION = resource("session", {
      PATCH: async ({ id, token }) => ({ id, token }),
    });
    const USER = resource("user", {
      GET: async ({ id }) => ({
        id,
        name: "Alice",
        session: { id: 10, token: "abc123" },
      }),
    });
    USER.one("session", SESSION);

    await USER.GET({ id: 1 });
    const user = USER.store.arraySignal.value[0];
    const sessionStore = SESSION.store.arraySignal.value;
    const userSession = user.session;

    await SESSION.PATCH({ id: 10, token: "xyz789" });
    const userSessionAfterUpdate = user.session;

    return {
      user,
      sessionStore,
      userSession,
      userSessionAfterUpdate,
    };
  });
});
