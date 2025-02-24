import { snapshotTests } from "@jsenv/snapshot";
import { createRouter } from "../../src/router/router.js";

const run = async (endpoints) => {
  const router = createRouter();
  for (const endpoint of endpoints) {
    router.add({
      endpoint,
      response: () => "hello",
    });
  }
  const result = await router.match({
    resource: "*",
    method: "OPTIONS",
  });
  return result;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    const withoutEndpoint = await run([]);
    const withGet = await run(["GET /users"]);
    const withGetAndPost = await run(["GET /users", "POST /users"]);
    const withGetPostPatchPut = await run([
      "GET /users",
      "POST /users",
      "PATCH /users/:id",
      "PUT /users/:id/*",
    ]);
    return {
      withoutEndpoint,
      withGet,
      withGetAndPost,
      withGetPostPatchPut,
    };
  });
});
