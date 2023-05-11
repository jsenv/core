import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async (name, params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    plugins: [jsenvPluginBundling()],
    ...params,
  });
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.namespacePromise,
    /* eslint-enable no-undef */
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
  const actual = returnValue;
  const expected = { bodyBackgroundColor: "rgb(255, 0, 0)" };
  assert({ actual, expected });
};

await test("default", {
  runtimeCompat: { chrome: "89" },
});
await test("no_versioning", {
  versioning: false,
  runtimeCompat: { chrome: "89" },
});
