import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = ({ runtimeCompat }) => {
  return build({
    sourceDirectoryUrl: new URL("./node_client/", import.meta.url),
    buildDirectoryUrl: new URL("./node_build/", import.meta.url),
    entryPoints: {
      "./index.js": {
        ignore: {
          "./node_modules/bar/": true,
        },
        runtimeCompat,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("node_0_import_meta_resolve", () =>
    run({
      runtimeCompat: { node: "20" },
    }));
  test("node_1_import_meta_resolve_fallback", () =>
    run({
      runtimeCompat: { node: "19" },
    }));
});
