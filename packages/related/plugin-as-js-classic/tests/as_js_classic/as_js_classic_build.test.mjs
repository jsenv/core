import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { replaceFileStructureSync } from "@jsenv/filesystem";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

const test = async (params) => {
  const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
  replaceFileStructureSync({
    from: new URL(`./fixtures/`, import.meta.url),
    to: sourceDirectoryUrl,
  });
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl,
    buildDirectoryUrl: snapshotDirectoryUrl,
    outDirectoryUrl: import.meta.resolve("./.jsenv/"),
    entryPoints: {
      "./main.html": {
        plugins: [jsenvPluginAsJsClassic()],
        ...params,
      },
    },
  });
  buildDirectorySnapshot.compare();
  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser(`${server.origin}/main.html`, {
    /* eslint-disable no-undef */
    pageFunction: () => window.answer,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expect = 42;
  assert({ actual, expect });
};

// no support for spread operator
await test({
  runtimeCompat: { chrome: "55" },
  bundling: false,
  minification: false,
});
