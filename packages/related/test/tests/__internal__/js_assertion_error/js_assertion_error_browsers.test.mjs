import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { execute, chromium, firefox, webkit } from "@jsenv/test";

const clientDirectoryUrl = new URL("./client", import.meta.url).href;

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  const { status, errors, consoleCalls } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
    // keepRunning: true,
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
    ...params,
  });
  devServer.stop();

  const error = errors[0];
  const actual = {
    status,
    consoleCalls,
    errorStack: error.stack,
    site: error.site,
  };
  const expectedErrorStack = {
    chromium:
      assert.startsWith(`Uncaught AssertionError: unexpected character in string
--- details ---
foo
^ unexpected "f", expected to continue with "bar"
--- path ---
actual[0]`),
    firefox: assert.startsWith(`AssertionError: unexpected character in string
--- details ---
foo
^ unexpected "f", expected to continue with "bar"
--- path ---
actual[0]
createAssertionError@`),
    webkit: assert.startsWith(`AssertionError: unexpected character in string
--- details ---
foo
^ unexpected "f", expected to continue with "bar"
--- path ---
actual[0]
createAssertionError@`),
  }[params.runtime.name];

  const expected = {
    status: "failed",
    consoleCalls: [],
    errorStack: expectedErrorStack,
    site: {
      isInline: true,
      url: `${clientDirectoryUrl}/main.html`,
      line: 9,
      column: 5,
      originalUrl: `${clientDirectoryUrl}/main.html@L10C5-L17C14.js`,
      serverUrl: `${devServer.origin}/main.html`,
    },
  };
  assert({ actual, expected });
};

await test({ runtime: chromium() });
await test({
  runtime: firefox({
    disableOnWindowsBecauseFlaky: false,
  }),
});
await test({ runtime: webkit() });
