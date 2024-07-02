import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";

const numberOfListenersAtStart = process.listeners("SIGINT").length;
const countListeners = () => {
  return process.listeners("SIGINT").length - numberOfListenersAtStart;
};

const beforeBuild = countListeners();
const buildPromise = build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./index.js": "index.js",
  },
});
const whileBuilding = countListeners();
await buildPromise;
const afterBuild = countListeners();
const actual = {
  beforeBuild,
  whileBuilding,
  afterBuild,
};
const expect = {
  beforeBuild: 0,
  whileBuilding: 1,
  afterBuild: 0,
};
assert({ actual, expect });
