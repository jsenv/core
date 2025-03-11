import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./index.html": "index.html" },
    runtimeCompat: { chrome: "89" },
    bundling: false,
    minification: false,
    versioning: false,
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  const fromRoot = await executeHtml(`${buildServer.origin}/index.html`);
  const fromDeepRoot = await executeHtml(`${buildServer.origin}/foo/bar`);
  return { fromRoot, fromDeepRoot };
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_inlining", () => run());
});
