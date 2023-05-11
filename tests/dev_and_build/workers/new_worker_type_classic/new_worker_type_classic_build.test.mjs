import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    transpilation: {
      // topLevelAwait: "ignore",
    },
    ...params,
  });
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.namespacePromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expected = {
    workerResponse: "pong",
    worker2Response: "pong",
  };
  assert({ actual, expected });
};

await test({
  plugins: [jsenvPluginBundling()],
});

// no bundling
await test();
