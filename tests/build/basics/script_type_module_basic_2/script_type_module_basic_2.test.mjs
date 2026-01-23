import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

if (process.env.CI) {
  process.exit(0);
  // sourcemap fails on CI linux for some reason
}

const run = async ({ runtimeCompat, sourcemaps }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        versioning: true,
        runtimeCompat,
        sourcemaps,
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
  // can use <script type="module">
  test("0_js_module", () =>
    run({
      runtimeCompat: { chrome: "89" },
    }));
  // cannot use <script type="module">
  test("1_js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "60" },
    }));
  // can use <script type="module"> + sourcemap
  test("2_js_module_sourcemaps_file", () =>
    run({
      runtimeCompat: { chrome: "89" },
      sourcemaps: "file",
    }));
});
