import { assert } from "@jsenv/assert";
import { takeDirectorySnapshot, takeFileSnapshot } from "@jsenv/snapshot";

import { build } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";

const test = async ({ buildDirectoryUrl, directoryReferenceEffect }) => {
  const { buildManifest } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    runtimeCompat: { chrome: "98" },
    bundling: false,
    minification: false,
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    directoryReferenceEffect,
  });
  const server = await startFileServer({
    rootDirectoryUrl: buildDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = {
    returnValue,
  };
  const expect = {
    returnValue: {
      directoryUrl: `${server.origin}/${buildManifest["src/"]}`,
    },
  };
  assert({ actual, expect });
};

// by default referencing a directory throw an error
try {
  await test({
    buildDirectoryUrl: new URL("./output/0_default/", import.meta.url),
  });
  throw new Error("should throw");
} catch (e) {
  const errorFileSnapshot = takeFileSnapshot(
    new URL("./output/0_default/error.txt", import.meta.url),
  );
  errorFileSnapshot.update(e.message);
}

// but it can be allowed explicitely and it will copy the directory content
// in the build directory and update the url accoringly
const outputDirectorySnapshot = takeDirectorySnapshot(
  new URL("./output/1_copy/", import.meta.url),
);
await test({
  buildDirectoryUrl: new URL("./output/1_copy/", import.meta.url),
  directoryReferenceEffect: "copy",
});
outputDirectorySnapshot.compare();
