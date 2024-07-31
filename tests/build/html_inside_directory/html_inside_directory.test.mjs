import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";

await snapshotBuildTests(
  ({ test }) => {
    test("0_basic", () =>
      build({
        sourceDirectoryUrl: new URL("./client/", import.meta.url),
        buildDirectoryUrl: new URL("./build/", import.meta.url),
        entryPoints: { "./src/main.html": "index.html" },
        bundling: false,
        minification: false,
      }));
  },
  new URL("./output/html_inside_directory.md", import.meta.url),
);

const server = await startFileServer({
  rootDirectoryUrl: new URL("./output/0_basic/build/", import.meta.url),
});
const { returnValue } = await executeInBrowser({
  url: `${server.origin}/index.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.resultPromise,
  /* eslint-enable no-undef */
});
const actual = returnValue;
const expect = 42;
assert({ actual, expect });
