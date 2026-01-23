import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
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
writeSymbolicLinkSync({
  from: import.meta.resolve("./git_ignored/node_modules/z-internal/"),
  to: import.meta.resolve("./git_ignored/packages/z-internal/"),
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
process.env.IGNORE_PACKAGE_CONDITIONS = "1";
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
        "dev:jsenv": {
          "internal/": false,
        },
      },
    }));

  test("2_external_dev", () =>
    run({
      packageConditions: {
        "dev:jsenv": {
          "external/": true,
        },
      },
    }));

  test("3_external_dev_internal_build", () =>
    run({
      packageConditions: {
        "dev:jsenv": {
          "external/": true,
          "internal/": false,
        },
      },
    }));
});
delete process.env.IGNORE_PACKAGE_CONDITIONS;
