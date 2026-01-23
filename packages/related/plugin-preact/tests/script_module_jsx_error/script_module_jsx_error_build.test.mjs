import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ runtimeCompat }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.noeslint.html": {
        buildRelativeUrl: "./main.html",
        bundling: false,
        minification: false,
        runtimeCompat,
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
  },
  {
    executionEffects: {
      catch(e) {
        e.stack = "";
      },
    },
  },
);
