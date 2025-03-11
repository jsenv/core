import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { ensureEmptyDirectory } from "@jsenv/filesystem";
import { jsenvPluginReact } from "@jsenv/plugin-react";

const run = async ({ runtimeCompat, minification }) => {
  await ensureEmptyDirectory(
    new URL("./.jsenv_b/build/cjs_to_esm/", import.meta.url),
  );
  await build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    plugins: [jsenvPluginReact({ asJsModuleLogLevel: "warn" })],
    bundling: false,
    runtimeCompat,
    minification,
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () =>
    run({
      runtimeCompat: { chrome: "89" },
    }));

  test("1_js_module_fallback", () =>
    run({
      runtimeCompat: {
        chrome: "55",
        edge: "14",
        firefox: "52",
        safari: "11",
      },
    }));

  test("2_js_module_fallback_minified", () =>
    run({
      runtimeCompat: {
        chrome: "55",
        edge: "14",
        firefox: "52",
        safari: "11",
      },
      minification: true,
    }));
});
