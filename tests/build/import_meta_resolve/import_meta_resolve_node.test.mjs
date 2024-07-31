import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./node_client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./index.js": "index.js" },
    ignore: {
      "./node_modules/bar/": true,
    },
  };
  test("node_0_import_meta_resolve", () =>
    build({
      ...testParams,
      runtimeCompat: { node: "20" },
    }));
  test("node_1_import_meta_resolve_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { node: "19" },
    }));
});
