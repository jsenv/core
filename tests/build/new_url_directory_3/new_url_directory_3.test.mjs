import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = ({ sourceDirectoryUrl, directoryReferenceEffect }) => {
  return build({
    sourceDirectoryUrl,
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.js": "main.js" },
    bundling: false,
    minification: false,
    runtimeCompat: { chrome: "98" },
    assetManifest: true,
    referenceAnalysis: {
      directoryReferenceEffect,
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
    test("4_copy_root", () =>
      run({
        sourceDirectoryUrl: new URL("./fixtures/0_root/", import.meta.url),
        directoryReferenceEffect: "copy",
      }));
    test("5_copy_foo", () =>
      run({
        sourceDirectoryUrl: new URL("./fixtures/1_foo/", import.meta.url),
        directoryReferenceEffect: "copy",
      }));
  },
  {
    logEffects: { ignore: true },
  },
);
