import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { ensureEmptyDirectory } from "@jsenv/filesystem";

import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

if (process.platform === "win32") {
  // sometimes timeout on windows
  process.exit(0);
}

const test = async ({ name, ...params }) => {
  await ensureEmptyDirectory(
    new URL("./.jsenv/build/cjs_to_esm/", import.meta.url),
  );
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
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
    ...params,
  });
  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser(`${server.origin}/main.html`);
  const actual = returnValue;
  const expect = {
    spanContentAfterIncrement: "1",
    spanContentAfterDecrement: "0",
  };
  assert({ actual, expect });
};

// support for <script type="module">
await test({
  name: "0_js_module",
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
  minification: false,
});
// no support for <script type="module">
await test({
  name: "1_js_module_fallback",
  runtimeCompat: { chrome: "62" },
  minification: false,
});
