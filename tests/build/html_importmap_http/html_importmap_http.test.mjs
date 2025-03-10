import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ runtimeCompat, http }) => {
  await build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    minification: false,
    http,
    runtimeCompat,
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  // can use <script type="module">
  // disabled because for now it would fail as import map gets removed
  // and there is "preact" raw specifier in the html/preact package
  // test("0_js_module", () =>
  //   run({
  //     runtimeCompat: { chrome: "89" },
  //   }),
  // );

  test("0_js_module_http_enabled", () =>
    run({
      runtimeCompat: { chrome: "89" },
      http: true,
    }));
});
