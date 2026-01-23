import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import { ensureEmptyDirectory } from "@jsenv/filesystem";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

if (
  // sometimes timeout on windows
  process.platform === "win32" ||
  // sometimes fail on linux, disable for now
  process.platform === "linux"
) {
  process.exit(0);
}

const run = async ({ runtimeCompat, bundling }) => {
  await ensureEmptyDirectory(
    new URL("./.jsenv_b/build/cjs_to_esm/", import.meta.url),
  );
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        minification: false,
        plugins: [
          jsenvPluginPreact(),
          jsenvPluginCommonJs({
            include: {
              "/**/node_modules/react-is/": true,
              "/**/node_modules/use-sync-external-store/": {
                external: ["react"],
              },
              "/**/node_modules/hoist-non-react-statics/": {
                // "react-redux" depends on
                // - react-is@18+
                // - hoist-non-react-statics@3.3.2+
                // but "hoist-non-react-statics@3.3.2" depends on
                // - react-is@16+
                // In the end there is 2 versions of react-is trying to cohabit
                // to prevent them to clash we let rollup inline "react-is" into "react-statics"
                // thanks to the comment below
                // external: ["react-is"],
              },
            },
          }),
        ],
        runtimeCompat,
        bundling,
        packageSideEffects: false,
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

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () =>
    run({
      runtimeCompat: { chrome: "89" },
      bundling: {
        js_module: {
          chunks: {
            // IT's ABSOLUTELY MANDATORY
            // WITHOUT THIS ROLLUP CREATES CIRCULAR DEP IN THE CODE
            // THAT IS NEVER RESOLVING
            vendors: { "file:///**/node_modules/": true },
          },
        },
      },
    }));

  test("1_js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "62" },
    }));
});
