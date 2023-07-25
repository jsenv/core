import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, ...params }) => {
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
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expected = {
    workerResponse: "pong",
    worker2Response: "pong",
  };
  assert({ actual, expected });
};

// support for {type: "module"} in new Worker
await test({
  name: "0_worker_type_module",
  runtimeCompat: { chrome: "81" },
  plugins: [jsenvPluginBundling()],
  versioning: false, // disable versioning to prevent fallback on js classic
});
// no support for {type: "module"} in new Worker
await test({
  name: "1_worker_type_module_not_supported",
  runtimeCompat: { chrome: "79" },
  plugins: [jsenvPluginBundling()],
  versioning: false,
});
// // no support for <script type="modue">
// await test("2_script_type_module_not_supported", {
//   runtimeCompat: { chrome: "62" },
//   plugins: [jsenvPluginBundling()],
// });
// // support + no bundling
// await test("3_worker_type_module_no_bundling", {
//   runtimeCompat: { chrome: "81" },
// });
// // no support + no bundling
// await test("4_worker_type_module_not_supported_no_bundling", {
//   runtimeCompat: { chrome: "79" },
// });
