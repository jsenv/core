import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        runtimeCompat: { node: "19" },
        directoryReferenceEffect: "copy",
      },
    },
  });
  const { directoryUrl } = await import(
    new URL("./build/main.js", import.meta.url)
  );
  return directoryUrl;
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_copy", () => run());
});
