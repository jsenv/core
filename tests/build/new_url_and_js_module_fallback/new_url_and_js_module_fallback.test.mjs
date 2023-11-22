import { takeDirectorySnapshotAndCompare } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  takeDirectorySnapshotAndCompare(
    new URL("./dist/", import.meta.url),
    new URL("./snapshots/", import.meta.url),
  );
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
