import { readFileSync } from "node:fs";
import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const expectedBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  const { buildManifest } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    runtimeCompat: { chrome: "98" },
    bundling: false,
    minification: false,
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  const actualBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  compareSnapshots(actualBuildSnapshot, expectedBuildSnapshot);

  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = {
    returnValue,
    jsFileContent: String(
      readFileSync(new URL("./dist/src/sub/file.js", import.meta.url)),
    ),
  };
  const expected = {
    returnValue: {
      directoryUrl: `${server.origin}/${buildManifest["src/"]}`,
    },
    jsFileContent: `console.log("Hello");\n`,
  };
  assert({ actual, expected });
};

// by default referencing a directory throw an error
try {
  await test();
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `Reference leads to a directory
--- reference trace ---
${new URL("./client/main.html", import.meta.url)}:15:40
  14 |     <script type="module">
> 15 |       const directoryUrl = new URL("./src/", import.meta.url).href;
                                              ^
  16 | `;
  assert({ actual, expected });
}

// but it can be allowed explicitely and it will copy the directory content
// in the build directory and update the url accorindgly
await test({ directoryReferenceAllowed: true });
