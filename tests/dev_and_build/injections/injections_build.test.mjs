import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_injection", () =>
    build({
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      bundling: false,
      minification: false,
      injections: {
        "./main.js": (urlInfo) => {
          return {
            __DEMO__: urlInfo.context.dev ? "dev" : "build",
          };
        },
      },
    }));
});

const actual = {
  injection: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_injection")}build/`,
  ),
};
const expect = {
  injection: "build",
};
assert({ actual, expect });
