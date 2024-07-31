import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(
  ({ test }) => {
    test("0_copy", () =>
      build({
        sourceDirectoryUrl: new URL("./client/", import.meta.url),
        buildDirectoryUrl: new URL("./build/", import.meta.url),
        entryPoints: { "./main.js": "main.js" },
        runtimeCompat: { node: "19" },
        directoryReferenceEffect: "copy",
      }));
  },
  new URL("./output/new_url_directory_2.md", import.meta.url),
);

// eslint-disable-next-line import/no-unresolved
const { directoryUrl } = await import("./output/0_copy/build/main.js");
const actual = directoryUrl;
const expect = new URL("./output/0_copy/build/src/", import.meta.url).href;
assert({ actual, expect });
