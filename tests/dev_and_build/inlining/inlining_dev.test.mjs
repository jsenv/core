import { assert } from "@jsenv/assert";
import { copyDirectorySync } from "@jsenv/filesystem";

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
  const { returnValue } = await executeInBrowser(
    `${devServer.origin}/main.html`,
  );
  const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
  copyDirectorySync({
    from: new URL(`./.jsenv/${runtimeId}/`, import.meta.url),
    to: new URL(`./snapshots/dev/`, import.meta.url),
    overwrite: true,
  });
  const actual = returnValue;
  const expect = 42;
  assert({ actual, expect });
};

await test();
