import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    injections: {
      "./main.js": (urlInfo) => {
        return {
          __DEMO__: urlInfo.context.dev ? "dev" : "build",
        };
      },
    },
    ...params,
  });
  buildDirectorySnapshot.compare();

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
  const expected = "build";
  assert({ actual, expected });
};

await test({
  bundling: false,
  minification: false,
});
