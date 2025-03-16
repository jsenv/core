import { build } from "@jsenv/core";
// import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ bundling }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./index.js": {
        runtimeCompat: { node: "20" },
        bundling,
        versioning: false,
        minification: false,
        logs: {
          level: "debug",
          disabled: true,
        },
      },
      "./client/main.html": {
        runtimeCompat: { chrome: "89" },
        bundling,
        versioning: false,
        minification: false,
        logs: {
          level: "debug",
        },
      },
    },
  });
};

await run({
  bundling: false,
});

// await snapshotBuildTests(import.meta.url, ({ test }) => {
//   test.ONLY("0_basic", () => run({ bundling: false }));

//   test("1_with_bundling", () => run({ bundling: true }));
// });
