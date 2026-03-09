import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ runtimeCompat, bundling }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        minification: false,
        runtimeCompat,
        bundling,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("default", () =>
    run({
      runtimeCompat: { chrome: "90" },
    }));
  test("vendors", () =>
    run({
      runtimeCompat: { chrome: "90" },
      bundling: {
        js_module: {
          chunks: {
            vendors: {
              "file://**/node_modules/": true,
              "./a.js": true,
            },
          },
        },
      },
    }));
  test("vendors_and_js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "88" },
      bundling: {
        js_module: {
          chunks: {
            vendors: {
              "file://**/node_modules/": true,
              "./a.js": true,
            },
          },
        },
      },
    }));
});
