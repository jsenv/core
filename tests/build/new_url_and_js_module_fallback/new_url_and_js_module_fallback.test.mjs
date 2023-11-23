import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const expectedBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  const actualBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  compareSnapshots(actualBuildSnapshot, expectedBuildSnapshot);

  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expected = `${server.origin}/other/file.txt?v=ead31da8`;
  assert({ actual, expected });
};

// no support for <script type="module">
await test({
  runtimeCompat: { chrome: "60" },
  bundling: false,
  minification: false,
});
