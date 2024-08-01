import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { getScenarioBuildUrl } = await snapshotBuildTests(
  import.meta.url,
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
);

// eslint-disable-next-line import/no-unresolved
const { directoryUrl } = await import(
  new URL("./main.js", getScenarioBuildUrl("0_copy"))
);
const actual = directoryUrl;
const expect = new URL("./src/", getScenarioBuildUrl("0_copy")).href;
assert({ actual, expect });
