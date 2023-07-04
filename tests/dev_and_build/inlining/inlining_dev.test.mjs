import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async () => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    keepProcessAlive: false,
    clientAutoreload: false,
    ribbon: false,
    supervisor: false,
  });
  const { returnValue } = await executeInBrowser({
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
  takeDirectorySnapshot(
    new URL(`./.jsenv/${runtimeId}/`, import.meta.url),
    new URL(`./snapshots/dev/`, import.meta.url),
    false,
  );
  const actual = returnValue;
  const expected = 42;
  assert({ actual, expected });
};

await test();
