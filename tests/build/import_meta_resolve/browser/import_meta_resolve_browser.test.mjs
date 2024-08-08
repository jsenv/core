import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ runtimeCompat }) => {
  return build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./index.js": "index.js" },
    minification: false,
    runtimeCompat,
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("chrome_0_import_meta_resolve", () =>
    run({
      runtimeCompat: { chrome: "107" },
    }));
  test("chrome_1_import_meta_resolve_fallback", () =>
    run({
      runtimeCompat: { chrome: "106" },
    }));
});
