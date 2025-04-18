import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ runtimeCompat }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: true,
        versioning: false,
        runtimeCompat,
      },
    },
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: import.meta.resolve("./build/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`, {
    pageFunction: async (jsRelativeUrl) => {
      const namespace = await import(jsRelativeUrl);
      return { ...namespace };
    },
    pageFunctionArg: "./js/main.js",
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    run({
      runtimeCompat: { chrome: "89" },
    }));
});
