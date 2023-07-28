import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";

const { buildFileContents } = await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.js": "main.js",
  },
  minification: false,
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
