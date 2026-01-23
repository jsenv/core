import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import {
  replaceFileStructureSync,
  writeSymbolicLinkSync,
} from "@jsenv/filesystem";

replaceFileStructureSync({
  from: import.meta.resolve("./fixtures/"),
  to: import.meta.resolve("./git_ignored/"),
});
writeSymbolicLinkSync({
  from: import.meta.resolve("./git_ignored/node_modules/workspace-package-a/"),
  to: import.meta.resolve("./git_ignored/packages/workspace-package-a/"),
});
writeSymbolicLinkSync({
  from: import.meta.resolve("./git_ignored/node_modules/workspace-package-b/"),
  to: import.meta.resolve("./git_ignored/packages/workspace-package-b/"),
});

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        buildRelativeUrl: "./main_after_build.js",
        runtimeCompat: { node: "20" },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
