import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    minification: false,
  };
  test("0_worker_type_module", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "89" },
    }));
  test("1_worker_type_module_no_bundling", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "89" },
      bundling: false,
      versioning: false,
    }));
  test("2_worker_type_module_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "79" },
    }));
  test("3_worker_type_module_fallback_no_bundling", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "79" },
      bundling: false,
    }));
  test("4_js_module_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "62" },
    }));
});

const actual = {
  workerTypeModule: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_worker_type_module")}build/`,
  ),
  workerTypeModuleNoBundling: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_worker_type_module_no_bundling")}build/`,
  ),
  workerTypeModuleFallback: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("2_worker_type_module_fallback")}build/`,
  ),
  workerTypeModuleFallbackNoBundling: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("3_worker_type_module_fallback_no_bundling")}build/`,
  ),
  jsModuleFallback: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("4_js_module_fallback")}build/`,
  ),
};
const expect = {
  workerTypeModule: {
    workerResponse: "pong",
    worker2Response: "pong",
  },
  workerTypeModuleNoBundling: {
    workerResponse: "pong",
    worker2Response: "pong",
  },
  workerTypeModuleFallback: {
    workerResponse: "pong",
    worker2Response: "pong",
  },
  workerTypeModuleFallbackNoBundling: {
    workerResponse: "pong",
    worker2Response: "pong",
  },
  jsModuleFallback: {
    workerResponse: "pong",
    worker2Response: "pong",
  },
};
assert({ actual, expect });
