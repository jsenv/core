import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { writeSymbolicLinkSync } from "@jsenv/filesystem";

if (process.platform !== "darwin") {
  process.exit(0);
}

writeSymbolicLinkSync({
  from: import.meta.resolve("./client/node_modules/foo/"),
  to: import.meta.resolve("./client/packages/foo/"),
  allowUseless: true,
  allowOverwrite: true,
});

const run = async ({ runtimeCompat, bundling }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./packages/bar/bar.js": {
        mode: "package",
        runtimeCompat,
        bundling,
        ignore: {
          "file://**/node_modules/": false,
        },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_default", () =>
    run({
      runtimeCompat: { chrome: "90" },
    }));
});
