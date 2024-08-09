import { startDevServer } from "@jsenv/core";
import { chromium, execute, firefox, webkit } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

if (process.env.CI) {
  // disabled on CI because generates the following warning
  // Window 'showModalDialog' function is deprecated and will be removed soon
  // for some reason
  process.exit(0);
}

const run = async ({ runtime }) => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  return execute({
    runtime,
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
  });
};

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
  test("0_chromium", () =>
    run({
      runtime: chromium(),
    }));
  test("1_firefox", () =>
    run({
      runtime: firefox({
        disableOnWindowsBecauseFlaky: false,
      }),
    }));
  test("2_webkit", () =>
    run({
      runtime: webkit(),
    }));
});
