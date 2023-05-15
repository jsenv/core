import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async (params) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    plugins: [jsenvPluginBundling()],
    ...params,
  });
  const actual = buildFileContents;
  const expected = actual;
  assert({ actual, expected });
};

takeDirectorySnapshot(
  new URL("./dist/", import.meta.url),
  new URL("./snapshots/", import.meta.url),
);

await test();
