import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { chromium, execute, firefox, webkit } from "@jsenv/test";
import stripAnsi from "strip-ansi";

if (process.env.CI) {
  // disabled on CI because generates the following warning
  // Window 'showModalDialog' function is deprecated and will be removed soon
  // for some reason
  process.exit(0);
}

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
    errorMessage: stripAnsi(error.message.trim()),
    site: error.site,
  };
  const expectedErrorMessage = `actual and expect are different

actual: "foo"
expect: "bar"`;
  const site = {
    chromium: {
      url: `${clientDirectoryUrl}/main.html`,
      line: 13,
      column: 7,
    },
    firefox: {
      url: `${clientDirectoryUrl}/main.html`,
      line: 13,
      column: 13,
    },
    webkit: {
      url: `${clientDirectoryUrl}/main.html`,
      line: 13,
      column: 13,
    },
  }[params.runtime.name];

  const expect = {
    status: "failed",
    consoleCalls: [],
    errorMessage: expectedErrorMessage,
    site,
  };
  assert({ actual, expect, details: params.runtime.name });
};

await test({ runtime: chromium() });
await test({
  runtime: firefox({
    disableOnWindowsBecauseFlaky: false,
  }),
});
await test({ runtime: webkit() });
