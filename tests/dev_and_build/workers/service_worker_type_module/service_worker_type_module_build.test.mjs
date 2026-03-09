import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

if (process.platform !== "darwin") {
  process.exit(0);
}

const run = async ({ runtimeCompat, versioning, bundling }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        minification: false,
        runtimeCompat,
        versioning,
        bundling,
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
  test("sw_type_module", () =>
    run({
      runtimeCompat: { chrome: "80" },
      versioning: false, // to prevent importmap forcing fallback on js classic
    }));
  test("sw_type_module_no_bundling", () =>
    run({
      runtimeCompat: { chrome: "80" },
      versioning: false, // to prevent importmap forcing fallback on js classic
      bundling: false,
    }));
  test("sw_type_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "79" },
    }));
  test("sw_type_module_fallback_no_bundling", () =>
    run({
      runtimeCompat: { chrome: "79" },
      bundling: false,
    }));
});
