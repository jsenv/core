import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { execute, chromium, firefox, webkit } from "@jsenv/test";

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
    clientAutoreload: {
      clientServerEventsConfig: {
        logs: false,
      },
    },
  });
  const { status, namespace, consoleCalls } = await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
    // keepRunning: true,
    mirrorConsole: false,
    collectConsole: true,
    ...params,
  });
  devServer.stop();
  const actual = {
    status,
    namespace,
    consoleCalls,
  };
  const expect = {
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
    consoleCalls: [
      {
        type: "log",
        text: `foo\n`,
      },
      {
        type: "log",
        text: `bar\n`,
      },
    ],
  };
  assert({ actual, expect });
};

await test({
  runtime: chromium(),
});
await test({
  runtime: firefox({
    disableOnWindowsBecauseFlaky: false,
  }),
});
await test({
  runtime: webkit(),
});
