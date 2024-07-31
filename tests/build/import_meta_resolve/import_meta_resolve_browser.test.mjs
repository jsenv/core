import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./index.js": "index.js" },
    minification: false,
  };
  test("chrome_0_import_meta_resolve", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "107" },
    }));
  test("chrome_1_import_meta_resolve_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "106" },
    }));
});
