import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import {
  replaceFileStructureSync,
  writeSymbolicLinkSync,
} from "@jsenv/filesystem";

replaceFileStructureSync({
  from: import.meta.resolve("./fixtures/basic/"),
  to: import.meta.resolve("./git_ignored/"),
});
writeSymbolicLinkSync({
  from: import.meta.resolve("./git_ignored/node_modules/bar/"),
  to: import.meta.resolve("./git_ignored/packages/bar/"),
});

const run = async ({ nodeEsmResolution }) => {
  await build({
    sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        buildRelativeUrl: "./main_build.js",
        runtimeCompat: { node: "20" },
        nodeEsmResolution,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  // by default
  // - node modules "default" is favored
  // - workspace modules "development" is favored
  test("0_basic", () =>
    run({
      nodeEsmResolution: undefined,
    }));

  // we can pick "default" for a given workspace
  test("1_default_on_workspace_module", () =>
    run({
      nodeEsmResolution: {
        "*": {},
      },
    }));

  test("1_dev_on_node_module", () =>
    run({
      nodeEsmResolution: {
        "*": {},
      },
    }));
});
