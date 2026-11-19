import { snapshotTests } from "@jsenv/snapshot";

import { createAction } from "../../../action/actions.js";
import { isKeepableRead, isRelationshipRead } from "../kept_reads.js";
import { resource } from "../resource_graph.js";

await snapshotTests(import.meta.url, ({ test }) => {
  const setupUser = () => {
    const GET = async ({ id }) => ({ id, name: "Alice" });
    const POST = async ({ name }) => ({ id: 1, name });
    const PUT = async ({ id, name }) => ({ id, name });
    const PATCH = async ({ id, name }) => ({ id, name });
    const DELETE = async ({ id }) => id;
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });
    return USER;
  };

  test("GET single resource", async () => {
    const USER = setupUser();
    const captureState = () => USER.store.arraySignal.value;

    const storeBefore = captureState();
    await USER.GET({ id: 1 });
    const storeAfter = captureState();

    return { storeBefore, storeAfter };
  });

  test("POST creates a resource", async () => {
    const USER = setupUser();
    const captureState = () => USER.store.arraySignal.value;

    const storeBefore = captureState();
    await USER.POST({ name: "Alice" });
    const storeAfter = captureState();

    return { storeBefore, storeAfter };
  });

  test("PUT updates a resource", async () => {
    const USER = setupUser();
    const captureState = () => USER.store.arraySignal.value;

    await USER.POST({ name: "Alice" });
    const storeBeforePut = captureState();
    await USER.PUT({ id: 1, name: "Bob" });
    const storeAfterPut = captureState();

    return { storeBeforePut, storeAfterPut };
  });

  test("PATCH updates a resource", async () => {
    const USER = setupUser();
    const captureState = () => USER.store.arraySignal.value;

    await USER.POST({ name: "Alice" });
    const storeBeforePatch = captureState();
    await USER.PATCH({ id: 1, name: "Alice Updated" });
    const storeAfterPatch = captureState();

    return { storeBeforePatch, storeAfterPatch };
  });

  test("DELETE removes a resource", async () => {
    const USER = setupUser();
    const captureState = () => USER.store.arraySignal.value;

    await USER.POST({ name: "Alice" });
    const storeBeforeDelete = captureState();
    await USER.DELETE({ id: 1 });
    const storeAfterDelete = captureState();

    return { storeBeforeDelete, storeAfterDelete };
  });

  // What a page kept for the next document writes of each read (see
  // page_kept.js): a resource's own read as rows, a relation's read not at
  // all — its value names rows of another store, under an owner — anything
  // else by its value.
  test("reads of a relation are told apart from reads kept by value", () => {
    const SESSION = resource("session");
    const USER = resource("user", { GET: async ({ id }) => ({ id }) });
    const USER_SESSION = USER.one("session", SESSION, {
      GET: async ({ id }) => ({ id, session: { id: 10 } }),
    });
    const USER_FRIENDS = USER.scopedMany("friends", {
      GET_MANY: async ({ id }) => [id, []],
    });
    const COUNT = createAction(async () => 3);
    const readOf = (action) => ({
      kept_as_rows: isKeepableRead(action),
      relationship: isRelationshipRead(action),
    });
    return {
      "USER.GET": readOf(USER.GET),
      "USER.one(session).GET": readOf(USER_SESSION.GET),
      "USER.scopedMany(friends).GET_MANY": readOf(USER_FRIENDS.GET_MANY),
      "USER.scopedMany(friends).GET_MANY bound": readOf(
        USER_FRIENDS.GET_MANY.bindParams({ id: 1 }),
      ),
      "createAction": readOf(COUNT),
    };
  });
});
