import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ runtimeCompat, bundling, versioning }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        minification: false,
        runtimeCompat,
        bundling,
        versioning,
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
  test("0_worker_type_module", () =>
    run({
      runtimeCompat: { chrome: "89" },
    }));
  test("1_worker_type_module_no_bundling", () =>
    run({
      runtimeCompat: { chrome: "89" },
      bundling: false,
      versioning: false,
    }));
  test("2_worker_type_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "79" },
    }));
  test("3_worker_type_module_fallback_no_bundling", () =>
    run({
      runtimeCompat: { chrome: "79" },
      bundling: false,
    }));
  test("4_js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "62" },
    }));
});
