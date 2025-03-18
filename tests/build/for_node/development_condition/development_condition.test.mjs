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
  from: import.meta.resolve("./git_ignored/node_modules/internal/"),
  to: import.meta.resolve("./git_ignored/packages/internal/"),
});

const run = async ({ packageConditions }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./git_ignored/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        buildRelativeUrl: "./main_build.js",
        runtimeCompat: { node: "20" },
        packageConditions,
        bundling: false,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  // by default
  // - node modules "default" is favored (build)
  // - workspace modules "development" is favored (dev)
  test("0_default", () =>
    run({
      packageConditions: {},
    }));

  test("1_internal_build", () =>
    run({
      packageConditions: {
        development: {
          "internal/": false,
        },
      },
    }));

  test("2_external_dev", () =>
    run({
      packageConditions: {
        development: {
          "external/": true,
        },
      },
    }));

  test("3_external_dev_internal_build", () =>
    run({
      packageConditions: {
        development: {
          "external/": true,
          "internal/": false,
        },
      },
    }));
});
