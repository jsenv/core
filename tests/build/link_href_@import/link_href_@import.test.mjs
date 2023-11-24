import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, ...params }) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
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
  buildDirectorySnapshot.compare();

  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.namespacePromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expected = { bodyBackgroundColor: "rgb(255, 0, 0)" };
  assert({ actual, expected });
};

await test({
  name: "default",
  runtimeCompat: { chrome: "89" },
  minification: false,
});
await test({
  name: "no_versioning",
  runtimeCompat: { chrome: "89" },
  minification: false,
  versioning: false,
});
