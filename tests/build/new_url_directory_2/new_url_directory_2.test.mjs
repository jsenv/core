import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.js": "main.js" },
    runtimeCompat: { node: "19" },
    directoryReferenceEffect: "copy",
  });
  const { directoryUrl } = await import(
    new URL("./build/main.js", import.meta.url)
  );
  return directoryUrl;
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_copy", () => run());
});
