import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ runtimeCompat }) => {
  await build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    bundling: false,
    minification: false,
    versioning: false,
    runtimeCompat,
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_import_meta_resolve", () =>
    run({
      runtimeCompat: { chrome: "107" }, // import.meta.resolve supported
    }));
  test("1_import_meta_resolve_fallback", () =>
    run({
      runtimeCompat: { chrome: "80" }, // module supported but import.meta.resolve is not
    }));
  test("2_js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "60" },
    }));
});
