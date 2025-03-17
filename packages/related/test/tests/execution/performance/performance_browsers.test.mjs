import { startDevServer } from "@jsenv/core";
import { chromium, execute, firefox, webkit } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

if (process.platform === "win32") {
  process.exit(0);
}

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
  const run = async ({ runtime }) => {
    const devServer = await startDevServer({
      logLevel: "off",
      sourceDirectoryUrl: import.meta.resolve("./client/"),
      keepProcessAlive: false,
      port: 0,
    });
    const { performance } = await execute({
      runtime,
      rootDirectoryUrl: import.meta.resolve("./client/"),
      webServer: {
        origin: devServer.origin,
        rootDirectoryUrl: import.meta.resolve("./client/"),
      },
      fileRelativeUrl: `./main.html`,
      collectPerformance: true,
    });
    devServer.stop();
    return { performance };
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
