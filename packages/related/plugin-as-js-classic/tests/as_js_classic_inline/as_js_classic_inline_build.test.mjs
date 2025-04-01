import { build } from "@jsenv/core";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL("./snapshots/build/", import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./client/"),
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
};

// support for <script type="module">
await test({
  runtimeCompat: { chrome: "89" },
  minification: false,
  versioning: false,
});
