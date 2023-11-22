import { takeDirectorySnapshotAndCompare } from "@jsenv/snapshot";
import { build } from "@jsenv/core";

const test = async ({ name, ...params }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshotAndCompare(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
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
