import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { build } from "@jsenv/core";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL("./snapshots/build/", import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    plugins: [jsenvPluginAsJsClassic()],
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  buildDirectorySnapshot.compare();
};

// support for <script type="module">
await test({
  runtimeCompat: { chrome: "89" },
  minification: false,
  versioning: false,
});
