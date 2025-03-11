import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./source/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.js": "main_build.js" },
    runtimeCompat: {
      node: "20",
    },
    // bundling: false,
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  // can use <script type="module">
  // disabled because for now it would fail as import map gets removed
  // and there is "preact" raw specifier in the html/preact package
  test("0_basic", () => run());
});
