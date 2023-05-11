import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";

const { buildFileContents } = await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  entryPoints: {
    "./main.js": "main.js",
  },
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  plugins: [jsenvPluginBundling()],
});
const actual = {
  numberOfCssFiles: Object.keys(buildFileContents).filter((key) =>
    key.startsWith("css/"),
  ).length,
};
const expected = {
  numberOfCssFiles: 1,
};
assert({ actual, expected });
