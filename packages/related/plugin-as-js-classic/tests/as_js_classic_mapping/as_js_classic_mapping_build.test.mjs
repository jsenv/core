import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const run = async () => {
  await build({
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./index.mjs": "index.mjs" },
    runtimeCompat: { node: "20" },
    subbuilds: [
      {
        buildDirectoryUrl: import.meta.resolve("./build/client/"),
        entryPoints: { "./client/main.js": "main.js" },
        plugins: [jsenvPluginAsJsClassic()],
        mappings: {
          "./client/main.js": "./client/main.js?as_js_classic",
        },
        sourcemaps: "file",
        sourcemapsSourcesContent: true,
        bundling: false,
        minification: false,
        versioning: false,
        runtimeCompat: {
          chrome: "0",
          firefox: "0",
        },
      },
    ],
    outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
