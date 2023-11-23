import { copyDirectorySync } from "@jsenv/filesystem";
import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async () => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    keepProcessAlive: false,
    clientAutoreload: false,
    ribbon: false,
    supervisor: false,
    port: 0,
  });
  const { returnValue } = await executeInBrowser({
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
  copyDirectorySync({
    from: new URL(`./.jsenv/${runtimeId}/`, import.meta.url),
    to: new URL(`./snapshots/dev/`, import.meta.url),
    overwrite: true,
  });
  const actual = returnValue;
  const expected = 42;
  assert({ actual, expected });
};

await test();
