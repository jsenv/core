import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";
import { ensureEmptyDirectory } from "@jsenv/filesystem";
import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

const plugins = [
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
];

const test = async (name, params) => {
  await ensureEmptyDirectory(
    new URL("./.jsenv/build/cjs_to_esm/", import.meta.url),
  );
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
    false,
  );
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expected = {
    spanContentAfterIncrement: "1",
    spanContentAfterDecrement: "0",
  };
  assert({ actual, expected });
};

// sometimes timeout on windows
if (process.platform !== "win32") {
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
}
