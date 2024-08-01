import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

if (process.platform !== "darwin") {
  process.exit(0);
}

await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    minification: false,
  };
  test("0_sw_type_module", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "80" },
      versioning: false, // to prevent importmap forcing fallback on js classic
    }));
  test("1_sw_type_module_no_bundling", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "80" },
      versioning: false, // to prevent importmap forcing fallback on js classic
      bundling: false,
    }));
  test("2_sw_type_module_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "79" },
    }));
  test("3_sw_type_module_fallback_no_bundling", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "79" },
      bundling: false,
    }));
});
