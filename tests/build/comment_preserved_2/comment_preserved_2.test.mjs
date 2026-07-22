/**
 * Exploratory: same as comment_preserved, but main.js re-exports from a
 * second file (lib.js) instead of declaring value itself. The comment sits
 * above an `export { value } from "./lib.js"` re-export statement, which
 * gets bundled/inlined rather than kept as-is.
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
