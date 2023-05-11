import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

const test = async ({ name, ...rest }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    runtimeCompat: { chrome: "90" },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...rest,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
};

await test({
  name: "chunks_default",
  plugins: [jsenvPluginBundling()],
});

await test({
  name: "chunks_vendors",
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
