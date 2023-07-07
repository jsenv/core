import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";
import { jsenvPluginMinification } from "@jsenv/plugin-minification";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async (name, options) => {
  const { buildManifest } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...options,
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
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${server.origin}/${buildManifest["other/jsenv.png"]}")`,
  };
  assert({ actual, expected });
};

// chrome 60 cannot use <script type="module"> nor constructable stylesheet
await test("0_js_module_fallback", {
  runtimeCompat: { chrome: "60" },
  plugins: [jsenvPluginBundling()],
});
// chrome 60 + no bundling
await test("1_js_module_fallback_no_bundling", {
  runtimeCompat: { chrome: "60" },
});
// chrome 88 has constructables stylesheet
// but cannot use js modules due to versioning via importmap (as it does not have importmap)
await test("2_js_module_fallback_css_minified", {
  runtimeCompat: { chrome: "88" },
  plugins: [
    jsenvPluginBundling(),
    jsenvPluginMinification({
      js_module: false,
      js_classic: false,
      css: true,
    }),
  ],
});
// chrome 89 can use js modules
await test("3_js_module", {
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
});
