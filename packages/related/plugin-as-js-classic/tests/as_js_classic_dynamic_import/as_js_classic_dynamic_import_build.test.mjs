import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL("./snapshots/build/", import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    plugins: [jsenvPluginAsJsClassic()],
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  buildDirectorySnapshot.compare();
  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser(`${server.origin}/main.html`, {
    /* eslint-disable no-undef */
    pageFunction: () => window.askPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expect = 42;
  assert({ actual, expect });
};

await test({
  bundling: false,
  minification: false,
});
