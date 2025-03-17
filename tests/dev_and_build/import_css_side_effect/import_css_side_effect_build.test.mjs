import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./index.html": "index.html" },
    runtimeCompat: { chrome: "89" },
    bundling: false,
    minification: false,
    versioning: false,
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: import.meta.resolve("./build/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/index.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () => run());
});
