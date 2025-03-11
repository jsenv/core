import { startDevServer } from "@jsenv/core";
import { chromium, execute, firefox, webkit } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

const run = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "off",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  const result = await execute({
    runtime,
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
  });
  devServer.stop();
  return result;
};

await snapshotFileExecutionSideEffects(
  import.meta.url,
  async ({ test }) => {
    test("0_chromium", () =>
      run({
        runtime: chromium(),
      }));
    test("1_firefox", () =>
      run({
        runtime: firefox({ disableOnWindowsBecauseFlaky: false }),
      }));
    test("2_webkit", () =>
      run({
        runtime: webkit(),
      }));
  },
  {
    executionEffects: { catch: true },
  },
);
