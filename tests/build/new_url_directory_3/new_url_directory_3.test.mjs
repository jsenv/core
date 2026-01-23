import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = ({
  sourceDirectoryUrl,
  directoryReferenceEffect,
  runtimeCompat = { chrome: "98" },
}) => {
  return build({
    sourceDirectoryUrl,
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        bundling: false,
        minification: false,
        assetManifest: true,
        directoryReferenceEffect,
        runtimeCompat,
      },
    },
  });
};

await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    test("0_resolve_root", () =>
      run({
        sourceDirectoryUrl: new URL("./fixtures/0_root/", import.meta.url),
        directoryReferenceEffect: "resolve",
      }));
    test("1_resolve_foo", () =>
      run({
        sourceDirectoryUrl: new URL("./fixtures/1_foo/", import.meta.url),
        directoryReferenceEffect: "resolve",
      }));
    test("2_resolve_root_and_foo", () =>
      run({
        sourceDirectoryUrl: new URL(
          "./fixtures/2_root_and_foo/",
          import.meta.url,
        ),
        directoryReferenceEffect: "resolve",
      }));
    test("3_preserve_root", () =>
      run({
        sourceDirectoryUrl: new URL("./fixtures/0_root/", import.meta.url),
        directoryReferenceEffect: "preserve",
      }));
    test("5_copy_root", () =>
      run({
        sourceDirectoryUrl: new URL("./fixtures/0_root/", import.meta.url),
        directoryReferenceEffect: "copy",
      }));
    test("6_copy_foo", () =>
      run({
        sourceDirectoryUrl: new URL("./fixtures/1_foo/", import.meta.url),
        directoryReferenceEffect: "copy",
      }));
    test("7_copy_fs_root", () =>
      run({
        sourceDirectoryUrl: new URL(
          "./fixtures/3_filesystem_root/",
          import.meta.url,
        ),
        directoryReferenceEffect: "copy",
      }));
    test("8_resolve_ancestor", () =>
      run({
        sourceDirectoryUrl: new URL("./fixtures/4_ancestor/", import.meta.url),
        directoryReferenceEffect: "resolve",
        runtimeCompat: {
          node: "16.14",
        },
      }));
  },
  {
    logEffects: { level: "warn" },
  },
);
