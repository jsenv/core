import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

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

await test("0_chunks_default", {
  plugins: [jsenvPluginBundling()],
});

await test("1_chunks_vendors", {
  plugins: [
    jsenvPluginBundling({
      js_module: {
        chunks: {
          vendors: {
            "file://**/node_modules/": true,
            "./a.js": true,
          },
        },
      },
    }),
  ],
});
