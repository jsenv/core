import { startDevServer } from "@jsenv/core";
import { chromium, execute, firefox, webkit } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
  const run = async ({ runtime }) => {
    const devServer = await startDevServer({
      logLevel: "warn",
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      keepProcessAlive: false,
      port: 0,
      clientAutoreload: {
        clientServerEventsConfig: { logs: false },
      },
    });
    const { consoleCalls } = await execute({
      rootDirectoryUrl: new URL("./client/", import.meta.url),
      webServer: {
        origin: devServer.origin,
        rootDirectoryUrl: new URL("./client/", import.meta.url),
      },
      fileRelativeUrl: `./main.html`,
      runtime,
      mirrorConsole: false,
      collectConsole: true,
    });
    devServer.stop();
    return { consoleCalls };
  };

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
