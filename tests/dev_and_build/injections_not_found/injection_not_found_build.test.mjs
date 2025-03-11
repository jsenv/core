import { build } from "@jsenv/core";

import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_injection", () =>
    build({
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
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
