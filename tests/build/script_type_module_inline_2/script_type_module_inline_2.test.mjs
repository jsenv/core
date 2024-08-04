import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

if (process.platform !== "darwin") {
  process.exit(0);
  // for some obscure reason html is sized at 18.5 kB on linux
  // and 18.6 kB on mac
  // we need to understand this at some point
}

const run = ({ runtimeCompat, sourcemaps }) => {
  return build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    minification: false,
    bundling: false,
    runtimeCompat,
    sourcemaps,
  });
};

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () =>
    run({
      runtimeCompat: { chrome: "89" },
    }));
  test("1_js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "64" },
    }));
  // At some point generating sourcemap in this scenario was throwing an error
  // because the sourcemap for js module files where not generated
  // and in the end code was expecting to find sourcemapUrlInfo.content
  // What should happen instead is that js modules files are gone, so their sourcemap
  // should not appear in the url graph.
  // We generate sourcemap here to ensure there won't be a regression on that
  test("2_js_module_fallback_and_sourcemap_as_file", () =>
    run({
      runtimeCompat: { chrome: "60" },
      sourcemaps: "file",
    }));
});

const actual = {
  jsModule: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_js_module")}build/`,
  ),
  jsModuleFallback: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_js_module_fallback")}build/`,
  ),
  jsModuleFallbackSourcemapFile: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("2_js_module_fallback_and_sourcemap_as_file")}build/`,
  ),
};
const expect = {
  jsModule: { answer: 42 },
  jsModuleFallback: { answer: 42 },
  jsModuleFallbackSourcemapFile: { answer: 42 },
};
assert({ actual, expect });
