import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async () => {
  const jsenvSrcDirectoryUrl = import.meta.resolve("../../../src/");
  const result = await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        runtimeCompat: {
          chrome: "64",
          edge: "79",
          firefox: "67",
          safari: "11.3",
        },
        bundling: {
          js_module: {
            chunks: {
              vendors: {
                "**/node_modules/": true,
                [jsenvSrcDirectoryUrl]: true,
              },
            },
          },
        },
      },
    },
  });
  return result;
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
