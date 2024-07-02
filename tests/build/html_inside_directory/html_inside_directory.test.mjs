import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./src/main.html": "index.html",
  },
  bundling: false,
  minification: false,
});
const server = await startFileServer({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
});
const { returnValue } = await executeInBrowser({
  url: `${server.origin}/index.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.resultPromise,
  /* eslint-enable no-undef */
});
const actual = returnValue;
const expect = 42;
assert({ actual, expect });
