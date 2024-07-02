/*
 * Test that js module referenced by a worker use versioned urls
 * as importmap are not supported in workers
 */

import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, ...rest }) => {
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
    ...rest,
  });
  // 1. snapshots
  buildDirectorySnapshot.compare();

  // 2. Ensure file executes properly
  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  assert({
    actual: returnValue,
    expect: {
      ping: "pong",
      workerResponse: "pong",
    },
  });
};

// support importmap
await test({
  name: "importmap",
  runtimeCompat: { chrome: "89" },
  bundling: false,
  minification: false,
});

// does not support importmap
await test({
  name: "systemjs",
  runtimeCompat: { chrome: "88" },
  bundling: false,
  minification: false,
});
