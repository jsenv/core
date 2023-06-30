import { assert } from "@jsenv/assert";

import { build, startBuildServer } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    versioning: false,
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/`, import.meta.url),
  );
  const server = await startBuildServer({
    logLevel: "warn",
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  const { returnValue, consoleOutput } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
    collectConsole: true,
  });
  const actual = {
    returnValue,
    consoleOutputRaw: consoleOutput.raw,
  };
  const expected = {
    returnValue: { fontFamily: "Roboto" },
    consoleOutputRaw: "",
  };
  assert({ actual, expected });
};

await test({ runtimeCompat: { chrome: "89" } });
