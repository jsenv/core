import { snapshotTests } from "@jsenv/snapshot";
import { effect, signal } from "@preact/signals";

import {
  isNetworkPolicyError,
  setNetworkPolicy,
} from "../../../action/network_policy.js";
import { resource } from "../resource_graph.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("GET_RANGE returns store items", async () => {
    const GAME = resource("game", {
      GET_RANGE: async ({ start, limit }) => ({
        items: Array.from({ length: limit }, (_, index) => ({
          id: start + index,
          name: `game ${start + index}`,
        })),
        start,
        count: 42,
      }),
      PATCH: async ({ id, ...props }) => ({ id, ...props }),
    });

    const range = await GAME.GET_RANGE({ start: 10, limit: 2 });
    const rowGiven = range.items[0];
    const rowIsStoreItem = rowGiven === GAME.store.select(10);
    await GAME.PATCH({ id: 10, name: "renamed" });

    return {
      start: range.start,
      count: range.count,
      ids: range.items.map((item) => item.id),
      rowIsStoreItem,
      // A write replaces the item, so a row following its own fields reads
      // them from the store (RESOURCE.useById) rather than from what it holds
      nameOnRowGiven: rowGiven.name,
      nameInStore: GAME.store.select(10).name,
    };
  });

  test("GET_RANGE completes the range from what was asked", async () => {
    const GAME = resource("game", {
      GET_RANGE: async () => ({ items: [{ id: 1 }, { id: 2 }] }),
    });

    const range = await GAME.GET_RANGE({ start: 4, limit: 2 });
    return { start: range.start, count: range.count };
  });

  test("GET_RANGE binds params and passes the range signal", async () => {
    let paramsSeen;
    let callerAbortSeen;
    const abortController = new AbortController();
    const GAME = resource("game", {
      GET_RANGE: async (params, { signal }) => {
        paramsSeen = params;
        abortController.abort();
        callerAbortSeen = signal.aborted;
        return { items: [], start: params.start, count: 0 };
      },
    });
    const radarGames = GAME.GET_RANGE.bindParams({ radar: 7 });

    await radarGames({ start: 0, limit: 10, signal: abortController.signal });

    return {
      paramsSeen,
      callerAbortSeen,
    };
  });

  test("GET_RANGE refuses a result that is not a range", async () => {
    const GAME = resource("game", {
      GET_RANGE: async () => [{ id: 1 }],
    });

    try {
      await GAME.GET_RANGE({ start: 0, limit: 10 });
      return "no error";
    } catch (e) {
      return e.message;
    }
  });

  // A range read under a policy that keeps reads in the store is no request:
  // it settles with the policy's error, which a list draws as its failure. A
  // policy whose reads go to the network lets it out.
  test("GET_RANGE under a network policy", async () => {
    let calls = 0;
    const GAME = resource("game", {
      GET_RANGE: async ({ start, limit }) => {
        calls++;
        return {
          items: Array.from({ length: limit }, (_, index) => ({
            id: start + index,
          })),
          start,
          count: 42,
        };
      },
    });
    const read = async () => {
      try {
        const range = await GAME.GET_RANGE({ start: 0, limit: 2 });
        return { ids: range.items.map((item) => item.id) };
      } catch (e) {
        return {
          error: e.name,
          isNetworkPolicyError: isNetworkPolicyError(e),
          reason: e.reason,
        };
      }
    };
    try {
      const online = await read();
      setNetworkPolicy("device");
      const reads_from_store = await read();
      setNetworkPolicy("device", { reads: "network" });
      const reads_from_network = await read();
      return { online, reads_from_store, reads_from_network, calls };
    } finally {
      setNetworkPolicy(null);
    }
  });

  // A write landing while a slice is being read makes that slice stand for a
  // collection that is gone: the read is called off and asked again, so the
  // answer holds the write — whether or not the callback listens to its
  // signal.
  test("GET_RANGE asked again when the collection moves during the read", async () => {
    const server = [
      { id: 1, name: "one" },
      { id: 2, name: "two" },
    ];
    const answers = [];
    const calls = [];
    const GAME = resource("game", {
      // a renamed row may move in the collection (sorted by name)
      rerunOn: { GET_RANGE: ["POST", "DELETE", "PATCH"] },
      GET_RANGE: async ({ start, limit }) => {
        // the server reads its rows when the request arrives
        const items = server.slice(start, start + limit).map((row) => ({
          ...row,
        }));
        const gate = deferred();
        answers.push(gate);
        calls.push(items.map((item) => item.name));
        await gate.promise; // deaf to its signal
        return { items, start, count: server.length };
      },
      PATCH: async ({ id, ...props }) => {
        const row = server.find((r) => r.id === id);
        Object.assign(row, props);
        return { ...row };
      },
    });
    const reading = GAME.GET_RANGE({ start: 0, limit: 2 });
    await Promise.resolve();
    await GAME.PATCH({ id: 2, name: "two written" });
    // the read called off answers late (its callback does not listen), and is
    // asked again once it has
    answers[0].resolve();
    for (let i = 0; i < 20 && answers.length < 2; i++) {
      await new Promise((resolve) => setTimeout(resolve));
    }
    answers[1]?.resolve();
    const range = await reading;
    return {
      calls,
      answer: range.items.map((item) => item.name),
      in_store: GAME.store.select(2).name,
      answer_invalidation_is_current:
        range.invalidation === GAME.GET_RANGE.invalidationSignal.peek(),
    };
  });

  // A slice says which params it answers: the ones bound when it was asked,
  // not the ones bound when it lands.
  test("GET_RANGE answer carries the params it was asked under", async () => {
    const qSignal = signal("a");
    const gates = [];
    const GAME = resource("game", {
      GET_RANGE: async ({ start, q }) => {
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
        return { items: [{ id: `${q}_${start}` }], start, count: 1 };
      },
    });
    const search = GAME.GET_RANGE.bindParams({ q: qSignal });
    const reading = search({ start: 0, limit: 1 });
    await Promise.resolve();
    qSignal.value = "b";
    gates[0].resolve();
    const range = await reading;
    return {
      params: range.params,
      ids: range.items.map((item) => item.id),
    };
  });

  // The rows a range brought leave the store once nothing holds them anymore
  // (step 08): the list that drew them, the composition naming them, a read
  // following one, a write of their own. Between one and two seconds after
  // the last let go of them, without a removal heard by anyone.
  test("rows a list let go of leave the store", async () => {
    const LINE = resource("line", {
      GET_RANGE: async ({ start, limit }) => ({
        items: Array.from({ length: limit }, (_, index) => ({
          id: start + index,
          name: `line ${start + index}`,
        })),
        start,
        count: 10,
      }),
      GET: async ({ id }) => ({ id, name: `line ${id} read alone` }),
    });
    const removalsHeard = [];
    LINE.GET_RANGE.observeRemovals((ids) => removalsHeard.push(ids));
    const range = await LINE.GET_RANGE({ start: 0, limit: 10 });
    // what a list run holds while it draws them
    const held = LINE.GET_RANGE.createHeldItems();
    range.items.forEach((item, index) => held.set(index, item));
    await LINE.GET({ id: 3 }); // written by a read of its own
    const stopReading = effect(() => {
      LINE.store.select(5); // followed by a render
    });
    const idsInStore = () => LINE.store.arraySignal.peek().map((row) => row.id);
    try {
      const while_drawn = idsInStore();
      held.clear(); // the list leaves
      LINE.GET_RANGE.invalidate(); // the composition naming them is gone
      await new Promise((resolve) => setTimeout(resolve, 2100));
      return {
        while_drawn,
        after_let_go: idsInStore(),
        removals_heard: removalsHeard,
      };
    } finally {
      stopReading();
    }
  });
});
