import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core/src/build/build.js"; // import build directly to avoid the dynamic improt

const numberOfListenersAtStart = process.listeners("SIGINT").length;
const countListeners = () => {
  return process.listeners("SIGINT").length - numberOfListenersAtStart;
};

const beforeBuild = countListeners();
const buildPromise = build({
  // logs: { level: "warn" },
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  buildDirectoryUrl: import.meta.resolve("./dist/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  entryPoints: {
    "./index.js": {},
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
