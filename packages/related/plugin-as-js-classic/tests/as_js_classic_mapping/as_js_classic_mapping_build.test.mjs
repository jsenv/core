import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const run = async ({ runtimeCompat }) => {
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./dist/"),
    entryPoints: { "./main.html": "main.html" },
    plugins: [jsenvPluginAsJsClassic()],
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    minification: false,
    runtimeCompat,
    mappings: {
      "./main.js": "./main.js?as_js_classic",
    },
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
