import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(
  ({ test }) => {
    test("0_basic", () =>
      build({
        sourceDirectoryUrl: new URL("./client/", import.meta.url),
        buildDirectoryUrl: new URL("./build/", import.meta.url),
        entryPoints: { "./elements.css": "elements.css" },
        minification: false,
      }));
  },
  new URL("./output/bundling_css.md", import.meta.url),
);
