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
    const captureState = () => USER.store.arraySignal.value;

    const storeBefore = captureState();
    await USER.GET({ id: 1 });
    const storeAfter = captureState();

    return { storeBefore, storeAfter };
  });

  test("POST creates a resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });
    const captureState = () => USER.store.arraySignal.value;

    const storeBefore = captureState();
    await USER.POST({ name: "Alice" });
    const storeAfter = captureState();

    return { storeBefore, storeAfter };
  });

  test("PUT updates a resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });
    const captureState = () => USER.store.arraySignal.value;

    await USER.POST({ name: "Alice" });
    const storeBeforePut = captureState();
    await USER.PUT({ id: 1, name: "Bob" });
    const storeAfterPut = captureState();

    return { storeBeforePut, storeAfterPut };
  });

  test("PATCH updates a resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });
    const captureState = () => USER.store.arraySignal.value;

    await USER.POST({ name: "Alice" });
    const storeBeforePatch = captureState();
    await USER.PATCH({ id: 1, name: "Alice Updated" });
    const storeAfterPatch = captureState();

    return { storeBeforePatch, storeAfterPatch };
  });

  test("DELETE removes a resource", async () => {
    const USER = resource("user", { GET, POST, PUT, PATCH, DELETE });
    const captureState = () => USER.store.arraySignal.value;

    await USER.POST({ name: "Alice" });
    const storeBeforeDelete = captureState();
    await USER.DELETE({ id: 1 });
    const storeAfterDelete = captureState();

    return { storeBeforeDelete, storeAfterDelete };
  });
});
