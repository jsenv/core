import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { copyFileSync, writeFileStructureSync } from "@jsenv/filesystem";

await snapshotBuildTests(
  ({ test }) => {
    test("0_basic", () =>
      build({
        sourceDirectoryUrl: new URL("./client/", import.meta.url),
        buildDirectoryUrl: new URL("./build/", import.meta.url),
        entryPoints: {
          "./a.js": "a.js",
          "./b.js": "b.js",
        },
        bundling: false,
        minification: false,
      }));
  },
  new URL("./output/js_entry_many.md", import.meta.url),
);

writeFileStructureSync(
  new URL("./git_ignored/", import.meta.url),
  new URL("./output/0_basic/build/", import.meta.url),
);
copyFileSync({
  from: new URL("./client/a.html", import.meta.url),
  to: new URL("./git_ignored/a.html", import.meta.url),
});
copyFileSync({
  from: new URL("./client/b.html", import.meta.url),
  to: new URL("./git_ignored/b.html", import.meta.url),
});
const actual = {
  aExecutionResult: await executeBuildHtmlInBrowser(
    new URL(`./git_ignored/`, import.meta.url),
    "a.html",
  ),
  bExecutionResult: await executeBuildHtmlInBrowser(
    new URL(`./git_ignored/`, import.meta.url),
    "b.html",
  ),
};
const expect = {
  aExecutionResult: "a-shared",
  bExecutionResult: "b-shared",
};
assert({ actual, expect });
