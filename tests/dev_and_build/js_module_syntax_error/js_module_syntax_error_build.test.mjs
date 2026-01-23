import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: { "./main.html": {} },
  });
};

await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic", () => run());
  },
  { executionEffects: { catch: true } },
);
