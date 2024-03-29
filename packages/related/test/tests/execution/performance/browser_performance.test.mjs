import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { execute, chromium, firefox, webkit } from "@jsenv/test";

if (process.platform === "win32") {
  process.exit(0);
}

const test = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  const { status, namespace, performance } = await execute({
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
    runtime,
    mirrorConsole: false,
    collectConsole: true,
    collectPerformance: true,
  });
  devServer.stop();
  const actual = {
    status,
    namespace,
    performance,
  };
  const expected = {
    status: "completed",
    namespace: {
      "/main.js": {
        status: "completed",
        exception: null,
        value: null,
        timings: {
          start: assert.any(Number),
          end: assert.any(Number),
        },
      },
    },
    performance: {
      timeOrigin: assert.any(Number),
      timing: actual.performance.timing,
      navigation: {
        type: 0,
        redirectCount: 0,
      },
      measures: {
        "a to b": assert.any(Number),
      },
    },
  };
  assert({ actual, expected });
};

await test({ runtime: chromium() });
await test({ runtime: firefox() });
await test({ runtime: webkit() });
