import { fetchUrl } from "@jsenv/fetch";
import { startServer } from "@jsenv/server";
import { snapshotTests } from "@jsenv/snapshot";

const run = async () => {
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
  });

  const response = await fetchUrl(server.origin);
  const actual = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
  return actual;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    return run({ cors: false });
  });
});
