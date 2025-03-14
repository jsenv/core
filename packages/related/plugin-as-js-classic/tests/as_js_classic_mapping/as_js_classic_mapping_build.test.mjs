import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const run = async ({ runtimeCompat }) => {
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./index.mjs": "index.mjs" },
    subbuilds: [
      {
        buildDirectoryUrl: import.meta.resolve("./build/client/"),
        entryPoints: { "./main.html": "main.html" },
        plugins: [jsenvPluginAsJsClassic()],
        minification: false,
        runtimeCompat,
        mappings: {
          "./client/main.js": "./client/main.js?as_js_classic",
        },
      },
    ],
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    run({
      runtimeCompat: { chrome: "55" },
    }));
});
