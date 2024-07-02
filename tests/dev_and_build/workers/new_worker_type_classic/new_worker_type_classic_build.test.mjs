import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
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
  const expect = {
    workerResponse: "pong",
    worker2Response: "pong",
  };
  assert({ actual, expect });
};

await test({
  minification: false,
});

// no bundling
await test({
  bundling: false,
  minification: false,
});
