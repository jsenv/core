import { startDevServer } from "@jsenv/core";
import { chromium, execute, firefox, webkit } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

const run = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "off",
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    keepProcessAlive: false,
    port: 0,
  });
  const result = await execute({
    runtime,
    rootDirectoryUrl: import.meta.resolve("./client/"),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: import.meta.resolve("./client/"),
    },
    fileRelativeUrl: `./main.html`,
  });
  devServer.stop();
  return result;
};

await snapshotFileExecutionSideEffects(
  import.meta.url,
  async ({ test }) => {
    test("chromium", () =>
      run({
        runtime: chromium(),
      }));
    test("firefox", () =>
      run({
        runtime: firefox({ disableOnWindowsBecauseFlaky: false }),
      }));
    test("webkit", () =>
      run({
        runtime: webkit(),
      }));
  },
  {
    executionEffects: { catch: true },
  },
);
