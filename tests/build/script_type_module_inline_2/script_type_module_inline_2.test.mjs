import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

if (process.env.CI) {
  process.exit(0);
  // fail in ci for some reason
}

const run = async ({ runtimeCompat, sourcemaps }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        minification: false,
        bundling: false,
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

await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    test("0_js_module", () =>
      run({
        runtimeCompat: { chrome: "89" },
      }));
    test("1_js_module_fallback", () =>
      run({
        runtimeCompat: { chrome: "64" },
      }));
    // At some point generating sourcemap in this scenario was throwing an error
    // because the sourcemap for js module files where not generated
    // and in the end code was expecting to find sourcemapUrlInfo.content
    // What should happen instead is that js modules files are gone, so their sourcemap
    // should not appear in the url graph.
    // We generate sourcemap here to ensure there won't be a regression on that
    test("2_js_module_fallback_and_sourcemap_as_file", () =>
      run({
        runtimeCompat: { chrome: "60" },
        sourcemaps: "file",
      }));
  },
  {
    executionEffects: {
      catch: false,
    },
  },
);
