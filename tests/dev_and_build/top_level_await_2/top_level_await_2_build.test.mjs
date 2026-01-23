import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

if (process.platform !== "darwin") {
  process.exit(0);
  // on linux the error stack is different
}

const run = async ({ runtimeCompat, versioning }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        runtimeCompat,
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

await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    test("0_top_level_await", () =>
      run({
        runtimeCompat: { chrome: "89" },
      }));
    test("1_top_level_await_fallback", () =>
      run({
        runtimeCompat: { chrome: "55" },
      }));
    // support for <script type="module"> but not TLA
    // Considering that TLA + export on old runtimes is not recommended:
    // - TLA should be reserved to entry points where exports are not needed)
    // - It would be overkill to use systemjs only because code uses TLA + export
    // -> Jsenv throw an error when TLA + exports is used and systemjs is not
    // (ideally jsenv would throw a custom error explaining all this)
    test("2_top_level_await_throw", () =>
      run({
        runtimeCompat: { chrome: "65" },
        versioning: false,
      }));
  },
  {
    executionEffects: {
      catch: (error) => {
        if (error.name === "TRANSFORM_URL_CONTENT_ERROR") {
          error.message =
            'Cannot export after a top-level await when using topLevelAwait: "simple"!';
          error.stack = "";
          delete error.cause;
        }
      },
    },
  },
);
