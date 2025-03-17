import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { replaceFileStructureSync } from "@jsenv/filesystem";

replaceFileStructureSync({
  from: import.meta.resolve("./fixtures/basic/"),
  to: import.meta.resolve("./git_ignored/"),
});

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./main.js": "main_build.js" },
    runtimeCompat: {
      node: "20",
    },
    // bundling: false,
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
