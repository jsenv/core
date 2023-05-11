import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { execute, chromium, firefox, webkit } from "@jsenv/test";

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
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
  const expected = {
    status: "completed",
    namespace: {
      "/main.js": {
        status: "completed",
        duration: assert.any(Number),
        exception: null,
        value: null,
      },
    },
    // there is also the html supervisor logs
    // we likely don't want them now
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
  assert({ actual, expected });
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
