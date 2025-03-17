import { build } from "@jsenv/core";

import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_injection", () =>
    build({
      sourceDirectoryUrl: import.meta.resolve("./client/"),
      buildDirectoryUrl: import.meta.resolve("./build/"),
      entryPoints: { "./main.html": "main.html" },
      injections: {
        "./main.html": () => {
          return {
            __DEMO__: "foo",
          };
        },
      },
    }));
});
