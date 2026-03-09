import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ runtimeCompat }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        versioning: false,
        runtimeCompat,
        packageSideEffects: false,
      },
    },
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: import.meta.resolve("./build/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("import_meta_resolve", () =>
    run({
      runtimeCompat: { chrome: "107" }, // import.meta.resolve supported
    }));
  test("import_meta_resolve_fallback", () =>
    run({
      runtimeCompat: { chrome: "80" }, // module supported but import.meta.resolve is not
    }));
  test("js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "60" },
    }));
});
