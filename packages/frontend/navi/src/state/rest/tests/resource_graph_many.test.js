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

  test(".many() links game to players via GET_MANY", async () => {
    const USER = resource("user", {
      PATCH: async ({ id, name }) => ({ id, name }),
    });
    const GAME = resource("game", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const GAME_PLAYERS = GAME.many("players", USER, {
      GET_MANY: async ({ id }) => ({
        id,
        players: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
      }),
    });
    const capturePlayers = () => [...GAME.store.arraySignal.value[0].players];

    await GAME.POST({ name: "chess" });
    const playersBeforeLoad = capturePlayers();

    await GAME_PLAYERS.GET_MANY({ id: 1 });
    const playersAfterLoad = capturePlayers();
    const userStore = USER.store.arraySignal.value;

    // players are entries of the shared user store: updating the user propagates
    await USER.PATCH({ id: 2, name: "Bob Updated" });
    const playersAfterUserPatch = capturePlayers();

    return {
      playersBeforeLoad,
      playersAfterLoad,
      userStore,
      playersAfterUserPatch,
    };
  });

  test(".many() DELETE removes one child from the relationship only", async () => {
    const USER = resource("user");
    const GAME = resource("game", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const GAME_PLAYERS = GAME.many("players", USER, {
      GET_MANY: async ({ id }) => ({
        id,
        players: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
      }),
      DELETE: async ({ id, userId }) => [id, userId],
    });
    const capturePlayers = () => [...GAME.store.arraySignal.value[0].players];

    await GAME.POST({ name: "chess" });
    await GAME_PLAYERS.GET_MANY({ id: 1 });
    const playersBeforeDelete = capturePlayers();

    const deleteResult = await GAME_PLAYERS.DELETE({ id: 1, userId: 2 });
    const playersAfterDelete = capturePlayers();
    // the user itself is not deleted, only the relationship
    const userStoreAfterDelete = USER.store.arraySignal.value;

    return {
      playersBeforeDelete,
      deleteResult,
      playersAfterDelete,
      userStoreAfterDelete,
    };
  });

  test(".many() DELETE_MANY removes several children from the relationship only", async () => {
    const USER = resource("user");
    const GAME = resource("game", {
      POST: async ({ name }) => ({ id: 1, name }),
    });
    const GAME_PLAYERS = GAME.many("players", USER, {
      GET_MANY: async ({ id }) => ({
        id,
        players: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
          { id: 3, name: "Charlie" },
        ],
      }),
      DELETE_MANY: async ({ id, userIds }) => [id, userIds],
    });
    const capturePlayers = () => [...GAME.store.arraySignal.value[0].players];

    await GAME.POST({ name: "chess" });
    await GAME_PLAYERS.GET_MANY({ id: 1 });
    const playersBeforeDelete = capturePlayers();

    const deleteManyResult = await GAME_PLAYERS.DELETE_MANY({
      id: 1,
      userIds: [1, 3],
    });
    const playersAfterDelete = capturePlayers();
    // users themselves are not deleted, only the relationship
    const userStoreAfterDelete = USER.store.arraySignal.value;

    return {
      playersBeforeDelete,
      deleteManyResult,
      playersAfterDelete,
      userStoreAfterDelete,
    };
  });
});
