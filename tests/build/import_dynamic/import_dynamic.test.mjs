import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";

await snapshotBuildTests(
  ({ test }) => {
    const testParams = {
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      bundling: false,
      minification: false,
      versioning: false,
    };
    test("0_js_module", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "89" },
      }));
    test("1_js_module_fallback", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "62" },
      }));
  },
  new URL("./output/import_dynamic.md", import.meta.url),
);

const testWindowResult = async (scenario, expectedFilename) => {
  const server = await startFileServer({
    rootDirectoryUrl: new URL(`./output/${scenario}/build/`, import.meta.url),
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expect = {
    answer: 42,
    nestedFeatureUrl: `${server.origin}${expectedFilename}`,
  };
  assert({ actual, expect });
};

await testWindowResult("0_js_module", "/js/nested_feature.js");
await testWindowResult(
  "1_js_module_fallback",
  "/js/nested_feature.nomodule.js",
);
