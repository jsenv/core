import { jsenvServiceErrorHandler, startServer } from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

const run = async (errorToThrow) => {
  const server = await startServer({
    keepProcessAlive: false,
    services: [jsenvServiceErrorHandler()],
    routes: [
      {
        endpoint: "GET *",
        fetch: () => {
          throw errorToThrow;
        },
      },
    ],
  });
  const response = await fetch(server.origin, {
    headers: {
      accept: "application/json",
    },
  });
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
  return actual;
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  test("0_throw_error", () => {
    const error = new Error("message");
    error.code = "TEST_CODE";
    return run(error);
  });

  test("1_throw_primitive", () => {
    return run("here");
  });
});
