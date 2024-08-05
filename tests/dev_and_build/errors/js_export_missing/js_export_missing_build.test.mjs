import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic", () =>
      build({
        sourceDirectoryUrl: new URL("./client/", import.meta.url),
        buildDirectoryUrl: new URL("./build/", import.meta.url),
        entryPoints: { "./main.html": "main.html" },
      }));
  },
  {
    errorTransform: (error) => {
      if (error.message) {
        error.message = error.message.split("\n").slice(0, 3).join("\n");
      }
      if (error.cause) {
        error.cause = {
          code: error.cause.code,
        };
      }
    },
  },
);
