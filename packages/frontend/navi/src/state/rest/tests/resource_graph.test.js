import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

const GET = async ({ id }) => ({ id, name: "Alice" });
const POST = async ({ name }) => ({ id: 1, name });
const PUT = async ({ id, name }) => ({ id, name });
const PATCH = async ({ id, name }) => ({ id, name });
const DELETE = async ({ id }) => id;

await snapshotTests(import.meta.url, ({ test }) => {
  test("GET single resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });

    const storeBefore = USER.store.arraySignal.value;
    await USER.GET.run({ id: 1 });
    const storeAfter = USER.store.arraySignal.value;

    return { storeBefore, storeAfter };
  });

  test("POST creates a resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });

    const storeBefore = USER.store.arraySignal.value;
    await USER.POST.run({ name: "Alice" });
    const storeAfter = USER.store.arraySignal.value;

    return { storeBefore, storeAfter };
  });

  test("PUT updates a resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });

    await USER.POST.run({ name: "Alice" });
    const storeBeforePut = USER.store.arraySignal.value;
    await USER.PUT.run({ id: 1, name: "Bob" });
    const storeAfterPut = USER.store.arraySignal.value;

    return { storeBeforePut, storeAfterPut };
  });

  test("PATCH updates a resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });

    await USER.POST.run({ name: "Alice" });
    const storeBeforePatch = USER.store.arraySignal.value;
    await USER.PATCH.run({ id: 1, name: "Alice Updated" });
    const storeAfterPatch = USER.store.arraySignal.value;

    return { storeBeforePatch, storeAfterPatch };
  });

  test("DELETE removes a resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });

    await USER.POST.run({ name: "Alice" });
    const storeBeforeDelete = USER.store.arraySignal.value;
    await USER.DELETE.run({ id: 1 });
    const storeAfterDelete = USER.store.arraySignal.value;

    return { storeBeforeDelete, storeAfterDelete };
  });
});
