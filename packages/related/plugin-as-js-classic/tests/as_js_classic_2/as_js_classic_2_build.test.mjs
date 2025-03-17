import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { copyFileSync, removeFileSync } from "@jsenv/filesystem";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL("./snapshots/", import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.js?as_js_classic": "main.js",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  buildDirectorySnapshot.compare();
  copyFileSync({
    from: new URL("./client/main.html", import.meta.url),
    to: new URL("./main.html", snapshotDirectoryUrl),
    overwrite: true,
  });
  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser(`${server.origin}/main.html`);
  removeFileSync(new URL("./main.html", snapshotDirectoryUrl));
  const actual = returnValue;
  const expect = {
    typeofCurrentScript: "object",
    answer: 42,
    url: `${server.origin}/main.js`,
  };
  assert({ actual, expect });
};

// support for <script type="module">
await test({
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginAsJsClassic()],
  bundling: false,
  minification: false,
});
