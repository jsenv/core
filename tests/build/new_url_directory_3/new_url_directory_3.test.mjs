import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = ({ directoryReferenceEffect }) => {
  return build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    bundling: false,
    minification: false,
    runtimeCompat: { chrome: "98" },
    assetManifest: true,
    directoryReferenceEffect,
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_resolve", () =>
    run({
      directoryReferenceEffect: "resolve",
    }));
  // test("1_preserve", () =>
  //   run({
  //     directoryReferenceEffect: "preserve",
  //   }));
});
