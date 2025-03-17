import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ bundling }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./main.html": "main.html" },
    minification: false,
    transpilation: {
      // topLevelAwait: "ignore",
    },
    bundling,
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: import.meta.resolve("./build/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    run({
      bundling: true,
    }));
  test("1_no_bundling", () =>
    run({
      bundling: false,
    }));
});
