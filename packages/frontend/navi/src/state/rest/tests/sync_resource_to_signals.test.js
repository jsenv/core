/* eslint-disable signals/no-value-after-await */
import { snapshotTests } from "@jsenv/snapshot";
import { signal } from "@preact/signals";
import { resource, syncResourceToSignals } from "../resource_graph.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("updates signal when uniqueKey property changes", async () => {
    const USER = resource("user", {
      idKey: "id",
      uniqueKeys: ["username"],
      PUT: async ({ id, username }) => ({ id, username }),
    });

    const usernameSignal = signal("alice");
    syncResourceToSignals(USER, { username: usernameSignal });

    USER.store.upsert({ id: 1, username: "alice" });
    const signalBeforeRename = usernameSignal.value;

    await USER.PUT({ id: 1, username: "alice-renamed" });
    const signalAfterRename = usernameSignal.value;

    return { signalBeforeRename, signalAfterRename };
  });

  test("updates signal when idKey property changes", async () => {
    const USER = resource("user", {
      idKey: "slug",
      uniqueKeys: [],
      PUT: async ({ slug, newSlug }) => [slug, { slug: newSlug }],
    });

    const slugSignal = signal("hello-world");
    syncResourceToSignals(USER, { slug: slugSignal });

    USER.store.upsert({ slug: "hello-world" });
    const signalBeforeChange = slugSignal.value;

    await USER.PUT({ slug: "hello-world", newSlug: "hello-world-updated" });
    const signalAfterChange = slugSignal.value;

    return { signalBeforeChange, signalAfterChange };
  });

  test("does not update signal when a different item changes", async () => {
    const USER = resource("user", {
      idKey: "id",
      uniqueKeys: ["username"],
      PUT: async ({ id, username }) => ({ id, username }),
    });

    const usernameSignal = signal("alice");
    syncResourceToSignals(USER, { username: usernameSignal });

    USER.store.upsert({ id: 1, username: "alice" });
    USER.store.upsert({ id: 2, username: "bob" });

    // rename "bob" — signal is tracking "alice"
    await USER.PUT({ id: 2, username: "bob-renamed" });
    const signalAfterOtherRename = usernameSignal.value;

    return { signalAfterOtherRename };
  });

  test("multiple property mappings are each synced independently", async () => {
    const USER = resource("user", {
      idKey: "id",
      uniqueKeys: ["username", "email"],
      PUT: async ({ id, username, email }) => ({ id, username, email }),
    });

    const usernameSignal = signal("alice");
    const emailSignal = signal("alice@example.com");
    syncResourceToSignals(USER, {
      username: usernameSignal,
      email: emailSignal,
    });

    USER.store.upsert({
      id: 1,
      username: "alice",
      email: "alice@example.com",
    });

    await USER.PUT({
      id: 1,
      username: "alice-renamed",
      email: "alice@example.com",
    });
    const afterUsernameRename = {
      username: usernameSignal.value,
      email: emailSignal.value,
    };

    await USER.PUT({
      id: 1,
      username: "alice-renamed",
      email: "new@example.com",
    });
    const afterEmailChange = {
      username: usernameSignal.value,
      email: emailSignal.value,
    };

    return { afterUsernameRename, afterEmailChange };
  });

  test("throws when property is not idKey or uniqueKey", () => {
    const USER = resource("user", {
      idKey: "id",
      uniqueKeys: ["username"],
    });

    const someSignal = signal("value");
    let error = null;
    try {
      syncResourceToSignals(USER, { unknownProp: someSignal });
    } catch (e) {
      error = e.message;
    }

    return { error };
  });
});
