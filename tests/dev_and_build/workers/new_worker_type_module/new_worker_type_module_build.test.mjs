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
  const expect = {
    workerResponse: "pong",
    worker2Response: "pong",
  };
  assert({ actual, expect });
};

// support for {type: "module"} in new Worker
await test({
  name: "0_worker_type_module",
  runtimeCompat: { chrome: "89" },
  minification: false,
});
// no support for {type: "module"} in new Worker
await test({
  name: "1_worker_type_module_not_supported",
  runtimeCompat: { chrome: "79" },
  minification: false,
});
// no support for <script type="modue">
await test({
  name: "2_script_type_module_not_supported",
  runtimeCompat: { chrome: "62" },
  minification: false,
});
// support + no bundling
await test({
  name: "3_worker_type_module_no_bundling",
  runtimeCompat: { chrome: "89" },
  bundling: false,
  minification: false,
  versioning: false,
});
// no support + no bundling
await test({
  name: "4_worker_type_module_not_supported_no_bundling",
  runtimeCompat: { chrome: "79" },
  bundling: false,
  minification: false,
});
