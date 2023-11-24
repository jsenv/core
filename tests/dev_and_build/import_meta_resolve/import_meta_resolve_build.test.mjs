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
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expected = {
    importMetaResolveReturnValue: `${server.origin}/js/foo.js`,
    __TEST__: `${server.origin}/js/foo.js`,
  };
  assert({ actual, expected });
};

// import.meta.resolve supported
await test({
  name: "0_supported",
  runtimeCompat: { chrome: "107" },
  bundling: false,
  minification: false,
  versioning: false,
});
// module supported but import.meta.resolve is not
await test({
  name: "1_not_supported",
  runtimeCompat: { chrome: "80" },
  bundling: false,
  minification: false,
  versioning: false,
});
// script module not supported
await test({
  name: "2_js_module_not_supported",
  runtimeCompat: { chrome: "60" },
  bundling: false,
  minification: false,
  versioning: false,
});
