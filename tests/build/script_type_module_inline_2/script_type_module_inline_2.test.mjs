import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(
  ({ test }) => {
    const testParams = {
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
      minification: false,
      bundling: false,
    };
    test("0_js_module", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "89" },
      }));
    test("1_js_module_fallback", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "64" },
      }));
    // At some point generating sourcemap in this scenario was throwing an error
    // because the sourcemap for js module files where not generated
    // and in the end code was expecting to find sourcemapUrlInfo.content
    // What should happen instead is that js modules files are gone, so their sourcemap
    // should not appear in the url graph.
    // We generate sourcemap here to ensure there won't be a regression on that
    test("2_js_module_fallback_and_sourcemap_as_file", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "60" },
        sourcemaps: "file",
      }));
  },
  new URL("./output/script_type_module_inline_2.md", import.meta.url),
);

const actual = {
  jsModule: await executeBuildHtmlInBrowser(
    new URL("./output/0_js_module/build/", import.meta.url),
  ),
  jsModuleFallback: await executeBuildHtmlInBrowser(
    new URL("./output/1_js_module_fallback/build/", import.meta.url),
  ),
  jsModuleFallbackSourcemapFile: await executeBuildHtmlInBrowser(
    new URL(
      "./output/2_js_module_fallback_and_sourcemap_as_file/build/",
      import.meta.url,
    ),
  ),
};
const expect = {
  jsModule: { answer: 42 },
  jsModuleFallback: { answer: 42 },
  jsModuleFallbackSourcemapFile: { answer: 42 },
};
assert({ actual, expect });
