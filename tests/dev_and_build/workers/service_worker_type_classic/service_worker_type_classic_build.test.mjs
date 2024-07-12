import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    ...params,
  });
  buildDirectorySnapshot.compare();

  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const { order, resourcesFromJsenvBuild } = returnValue.inspectResponse;

  const actual = {
    order,
    resourcesFromJsenvBuild,
  };
  const expect = {
    order: ["before-a", "before-b", "b", "after-b", "after-a"],
    resourcesFromJsenvBuild: {
      "/main.html": {
        version: "090593aa",
      },
      "/css/style.css": {
        version: "2e9d11a2",
        versionedUrl: "/css/style.css?v=2e9d11a2",
      },
      "/js/a.js": {
        version: "76c9c177",
        versionedUrl: "/js/a.js?v=76c9c177",
      },
      "/js/b.js": {
        version: "54f517a9",
        versionedUrl: "/js/b.js?v=54f517a9",
      },
    },
  };
  assert({ actual, expect });
};

if (process.platform === "darwin") {
  await test({
    minification: false,
  });
}
