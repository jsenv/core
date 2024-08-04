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
    port: 0,
  });
  const { returnValue } = await executeInBrowser(
    `${devServer.origin}/main.html`,
  );
  const actual = returnValue;
  const expect = "data:";
  assert({ actual, expect });
};

await test();
