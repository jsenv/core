import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("ownOne profile GET and PATCH", async () => {
    const USER = resource("user", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const USER_PROFILE = USER.scopedOne("profile", {
      GET: async ({ id }) => [id, { bio: "Hello world", avatar: "alice.png" }],
      PATCH: async ({ id, bio }) => [id, { bio, avatar: "alice.png" }],
    });

    await USER.POST({ name: "Alice" });
    const user = USER.store.arraySignal.value[0];
    const profileBeforeGet = user.profile;

    await USER_PROFILE.GET({ id: 1 });
    const profileAfterGet = { ...user.profile };

    await USER_PROFILE.PATCH({ id: 1, bio: "Updated bio" });
    const profileAfterPatch = { ...user.profile };

    return { profileBeforeGet, profileAfterGet, profileAfterPatch };
  });
});
