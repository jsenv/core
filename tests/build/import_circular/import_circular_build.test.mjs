// https://github.com/rollup/rollup/tree/dba6f13132a1d7dac507d5056399d8af0eed6375/test/function/samples/preserve-modules-circular-order

import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { getScenarioBuildUrl } = await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    const testParams = {
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.js": "main.js" },
      minification: false,
      versioning: false,
      base: "./",
    };

    test("0_with_bundling", () =>
      build({
        ...testParams,
        bundling: true,
      }));

    test("1_without_bundling", () =>
      build({
        ...testParams,
        bundling: false,
      }));
  },
);

// with bundling (default)
{
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import(
    new URL("main.js", getScenarioBuildUrl("0_with_bundling"))
  );
  const actual = { ...namespace };
  const expect = {
    executionOrder: ["index", "tag", "data", "main: Tag: Tag data Tag data"],
  };
  assert({ actual, expect });
}

// without bundling
{
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import(
    new URL("main.js", getScenarioBuildUrl("1_without_bundling"))
  );
  const actual = { ...namespace };
  const expect = {
    executionOrder: ["index", "tag", "data", "main: Tag: Tag data Tag data"],
  };
  assert({ actual, expect });
}
