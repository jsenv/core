import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("GET_PAGE returns store items", async () => {
    const GAME = resource("game", {
      GET_PAGE: async ({ start, limit }) => ({
        items: Array.from({ length: limit }, (_, index) => ({
          id: start + index,
          name: `game ${start + index}`,
        })),
        start,
        count: 42,
      }),
      PATCH: async ({ id, ...props }) => ({ id, ...props }),
    });

    const page = await GAME.GET_PAGE({ start: 10, limit: 2 });
    const rowGiven = page.items[0];
    const rowIsStoreItem = rowGiven === GAME.store.select(10);
    await GAME.PATCH({ id: 10, name: "renamed" });

    return {
      start: page.start,
      count: page.count,
      ids: page.items.map((item) => item.id),
      rowIsStoreItem,
      // A write replaces the item, so a row following its own fields reads
      // them from the store (RESOURCE.useById) rather than from what it holds
      nameOnRowGiven: rowGiven.name,
      nameInStore: GAME.store.select(10).name,
    };
  });

  test("GET_PAGE completes the page from what was asked", async () => {
    const GAME = resource("game", {
      GET_PAGE: async () => ({ items: [{ id: 1 }, { id: 2 }] }),
    });

    const page = await GAME.GET_PAGE({ start: 4, limit: 2 });
    return { start: page.start, count: page.count };
  });

  test("GET_PAGE binds params and passes the range signal", async () => {
    let paramsSeen;
    let signalSeen;
    const GAME = resource("game", {
      GET_PAGE: async (params, { signal }) => {
        paramsSeen = params;
        signalSeen = signal;
        return { items: [], start: params.start, count: 0 };
      },
    });
    const radarGames = GAME.GET_PAGE.bindParams({ radar: 7 });

    const abortController = new AbortController();
    await radarGames({ start: 0, limit: 10, signal: abortController.signal });

    return {
      paramsSeen,
      signalGiven: signalSeen === abortController.signal,
    };
  });

  test("GET_PAGE refuses a result that is not a page", async () => {
    const GAME = resource("game", {
      GET_PAGE: async () => [{ id: 1 }],
    });

    try {
      await GAME.GET_PAGE({ start: 0, limit: 10 });
      return "no error";
    } catch (e) {
      return e.message;
    }
  });
});
