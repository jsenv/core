import { startDevServer } from "@jsenv/core";
import { chromium, execute, firefox, webkit } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

const run = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    keepProcessAlive: false,
    port: 0,
    clientAutoreload: {
      clientServerEventsConfig: { logs: false },
    },
  });
  const { consoleCalls } = await execute({
    rootDirectoryUrl: import.meta.resolve("./client/"),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: import.meta.resolve("./client/"),
    },
    fileRelativeUrl: `./main.html`,
    runtime,
    mirrorConsole: false,
    collectConsole: true,
  });
  devServer.stop();
  return { consoleCalls };
};

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
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
});
