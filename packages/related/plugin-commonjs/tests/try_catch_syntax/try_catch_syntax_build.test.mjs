import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

const run = () => {
  return build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        runtimeCompat: { chrome: "89" },
        bundling: {
          css: true,
          js_module: false,
        },
        minification: false,
        plugins: [
          jsenvPluginCommonJs({
            include: {
              "./lib/": true,
            },
          }),
        ],
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
