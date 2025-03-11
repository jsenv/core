import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

const test = async ({ name, ...params }) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  directorySnapshot.compare();
};

await test({
  name: "0_default",
  runtimeCompat: { chrome: "90" },
  minification: false,
});

await test({
  name: "1_vendors",
  runtimeCompat: { chrome: "90" },
  bundling: {
    js_module: {
      chunks: {
        vendors: {
          "file://**/node_modules/": true,
          "./a.js": true,
        },
      },
    },
  },
  minification: false,
});

await test({
  name: "2_vendors_and_js_module_fallback",
  runtimeCompat: { chrome: "88" },
  bundling: {
    js_module: {
      chunks: {
        vendors: {
          "file://**/node_modules/": true,
          "./a.js": true,
        },
      },
    },
  },
  minification: false,
});
