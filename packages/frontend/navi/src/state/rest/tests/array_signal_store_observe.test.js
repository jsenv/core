import { snapshotTests } from "@jsenv/snapshot";
import { arraySignalStore } from "../array_signal_store.js";

await snapshotTests(import.meta.url, ({ test }) => {
  // observeProperties tests

  test("observeProperties calls callback when any property changes", () => {
    const store = arraySignalStore([], "id", {});
    store.upsert({ id: 1, name: "alice", age: 30 });

    const calls = [];
    store.observeProperties((mutationsArray) => {
      calls.push(mutationsArray);
    });
  });

  test("observeProperties with properties filter only calls when watched property changes", () => {
    const store = arraySignalStore([], "id", {});
    store.upsert({ id: 1, name: "alice", role: "user" });

    const nameCalls = [];
    const roleCalls = [];
    store.observeProperties(
      (mutationsArray) => {
        nameCalls.push(mutationsArray);
      },
      { properties: ["name"] },
    );
    store.observeProperties(
      (mutationsArray) => {
        roleCalls.push(mutationsArray);
      },
      { properties: ["role"] },
    );

    store.upsert({ id: 1, name: "alice-renamed" }); // only name changes
    store.upsert({ id: 1, role: "admin" }); // only role changes

    return { nameCalls, roleCalls };
  });

  test("observeProperties with properties filter not called when unrelated property changes", () => {
    const store = arraySignalStore([], "id", {});
    store.upsert({ id: 1, name: "alice", age: 30 });

    let called = false;
    store.observeProperties(
      () => {
        called = true;
      },
      { properties: ["name"] },
    );

    store.upsert({ id: 1, age: 31 }); // only age changes, name not watched

    return { called };
  });

  test("observeProperties unsubscribe stops receiving callbacks", () => {
    const store = arraySignalStore([], "id", {});
    store.upsert({ id: 1, name: "alice" });

    const calls = [];
    const unsubscribe = store.observeProperties((mutationsArray) => {
      calls.push(mutationsArray);
    });

    store.upsert({ id: 1, name: "bob" });
    unsubscribe();
    store.upsert({ id: 1, name: "charlie" });

    return { calls };
  });

  test("observeProperties receives mutations from multiple items changed in batch", () => {
    const store = arraySignalStore([], "id", {});
    store.upsert([
      { id: 1, name: "alice" },
      { id: 2, name: "bob" },
    ]);

    const calls = [];
    store.observeProperties((mutationsArray) => {
      calls.push(mutationsArray);
    });

    store.upsert([
      { id: 1, name: "alice-renamed" },
      { id: 2, name: "bob-renamed" },
    ]);

    return { calls };
  });

  // observeItemProperties tests

  test("observeItemProperties calls callback when watched item property changes", () => {
    const store = arraySignalStore([], "id", { uniqueKeys: ["username"] });
    store.upsert({ id: 1, username: "alice", role: "user" });

    const usernameSignal = store.signalForKey("username", {
      peek: () => "alice",
      value: "alice",
    });

    const calls = [];
    store.observeItemProperties(usernameSignal, (mutations) => {
      calls.push(mutations);
    });

    store.upsert({ id: 1, role: "admin" });

    return { calls };
  });

  test("observeItemProperties with properties filter only calls when watched property changes", () => {
    const store = arraySignalStore([], "id", { uniqueKeys: ["username"] });
    store.upsert({ id: 1, username: "alice", role: "user", age: 30 });

    const usernameSignal = store.signalForKey("username", {
      peek: () => "alice",
      value: "alice",
    });

    const roleCalls = [];
    const ageCalls = [];
    store.observeItemProperties(
      usernameSignal,
      (mutations) => {
        roleCalls.push(mutations);
      },
      { properties: ["role"] },
    );
    store.observeItemProperties(
      usernameSignal,
      (mutations) => {
        ageCalls.push(mutations);
      },
      { properties: ["age"] },
    );

    store.upsert({ id: 1, role: "admin" }); // only role changes
    store.upsert({ id: 1, age: 31 }); // only age changes

    return { roleCalls, ageCalls };
  });

  test("observeItemProperties not called when a different item changes", () => {
    const store = arraySignalStore([], "id", { uniqueKeys: ["username"] });
    store.upsert({ id: 1, username: "alice", role: "user" });
    store.upsert({ id: 2, username: "bob", role: "user" });

    const aliceSignal = store.signalForKey("username", {
      peek: () => "alice",
      value: "alice",
    });

    let called = false;
    store.observeItemProperties(aliceSignal, () => {
      called = true;
    });

    store.upsert({ id: 2, role: "admin" }); // bob changes, not alice

    return { called };
  });

  test("observeItemProperties unsubscribe stops receiving callbacks", () => {
    const store = arraySignalStore([], "id", { uniqueKeys: ["username"] });
    store.upsert({ id: 1, username: "alice", role: "user" });

    const usernameSignal = store.signalForKey("username", {
      peek: () => "alice",
      value: "alice",
    });

    const calls = [];
    const unsubscribe = store.observeItemProperties(
      usernameSignal,
      (mutations) => {
        calls.push(mutations);
      },
    );

    store.upsert({ id: 1, role: "admin" });
    unsubscribe();
    store.upsert({ id: 1, role: "superadmin" });

    return { calls };
  });
});
