import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const run = async () => {
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    outDirectoryUrl: import.meta.resolve("./.jsenv/"),
    entryPoints: {
      "./index.mjs": {
        runtimeCompat: { node: "20" },
        mappings: {
          "./client/main.js": "./client/main.js?as_js_classic",
        },
      },
      "./client/main.js?as_js_classic": {
        runtimeCompat: { chrome: "0", firefox: "0" },
        plugins: [jsenvPluginAsJsClassic()],
        sourcemaps: "file",
        sourcemapsSourcesContent: true,
        bundling: false,
        minification: false,
        versioning: false,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
