import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async (name, params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    runtimeCompat: { chrome: "90" },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
};

await test({
  name: "0_chunks_default",
});

await test({
  name: "1_chunks_vendors",
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
});
