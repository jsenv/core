import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        injections: {
          "./main.html": () => {
            return {
              __BACKEND_URL__: "https://api.example.com",
            };
          },
        },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("backend_url_in_attribute", () => run());
});
