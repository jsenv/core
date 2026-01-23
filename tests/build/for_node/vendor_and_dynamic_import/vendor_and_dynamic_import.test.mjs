import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async (params) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        buildRelativeUrl: "./main_build.js",
        runtimeCompat: { node: "20" },
        ...params,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  // can use <script type="module">
  // disabled because for now it would fail as import map gets removed
  // and there is "preact" raw specifier in the html/preact package
  test("0_basic", () => run());

  test("1_include_dependencies", () => run({ packageDependencies: "include" }));
});
