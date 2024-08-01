import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

if (process.platform !== "darwin") {
  process.exit(0);
}

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    minification: false,
  };
  test("0_basic", () =>
    build({
      ...testParams,
    }));
});

const actual = {
  basic: await executeBuildHtmlInBrowser(`${dirUrlMap.get("0_basic")}build/`),
};
const expect = {
  basic: {
    inspectResponse: {
      order: ["before-a", "before-b", "b", "after-b", "after-a"],
      resourcesFromJsenvBuild: {
        "/main.html": {
          version: "a3b3b305",
        },
        "/css/style.css": {
          version: "2e9d11a2",
          versionedUrl: "/css/style.css?v=2e9d11a2",
        },
        "/js/a.js": {
          version: "76c9c177",
          versionedUrl: "/js/a.js?v=76c9c177",
        },
        "/js/b.js": {
          version: "54f517a9",
          versionedUrl: "/js/b.js?v=54f517a9",
        },
      },
    },
  },
};
assert({ actual, expect });
