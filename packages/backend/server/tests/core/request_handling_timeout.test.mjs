import { startServer } from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

const run = async ({ waitForEver }) => {
  const server = await startServer({
    keepProcessAlive: false,
    responseTimeout: 500,
    requestBodyLifetime: 200,
    routes: [
      {
        endpoint: "GET *",
        fetch: async () => {
          if (waitForEver) {
            await new Promise(() => {});
          }
          return { status: 200 };
        },
      },
    ],
  });
  const response = await fetch(server.origin);
  return {
    status: response.status,
    statusText: response.statusText,
  };
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  test("0_regular", async () => {
    return run({ waitForEver: false });
  });
  test("1_timing_out", async () => {
    return run({ waitForEver: true });
  });
});
