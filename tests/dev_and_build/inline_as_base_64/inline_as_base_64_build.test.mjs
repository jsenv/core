import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_inline_base64", () =>
    build({
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      runtimeCompat: { chrome: "89" },
      bundling: false,
      minification: false,
      versioning: false,
    }));
});

const actual = {
  inlineBase64: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_inline_base64")}build/`,
  ),
};
const expect = {
  inlineBase64: "data:",
};
assert({ actual, expect });
