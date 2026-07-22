/**
 * Exploratory: what happens to a top-level comment in a JS file when built
 * with mode: "package"? See navi's AI_INSTRUCTIONS.md work for context —
 * we found rollup drops comments attached to import/re-export statements,
 * but keeps them when attached to a real retained declaration.
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = () => {
  return build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        mode: "package",
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("basic", () => run());
});
