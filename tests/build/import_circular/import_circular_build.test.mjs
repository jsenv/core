// https://github.com/rollup/rollup/tree/dba6f13132a1d7dac507d5056399d8af0eed6375/test/function/samples/preserve-modules-circular-order

import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";

const test = async ({ name, ...params }) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const expectedBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.js": "main.js",
    },
    ...params,
  });
  const actualBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  compareSnapshots(actualBuildSnapshot, expectedBuildSnapshot);
};

// default (with bundling)
{
  await test({
    name: "0_with_bundling",
    base: "./",
    minification: false,
    versioning: false,
  });
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import("./snapshots/0_with_bundling/main.js");
  const actual = { ...namespace };
  const expected = {
    executionOrder: ["index", "tag", "data", "main: Tag: Tag data Tag data"],
  };
  assert({ actual, expected });
}

// without bundling
{
  await test({
    name: "1_without_bundling",
    base: "./",
    bundling: false,
    minification: false,
    versioning: false,
  });
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import("./snapshots/1_without_bundling/main.js");
  const actual = { ...namespace };
  const expected = {
    executionOrder: ["index", "tag", "data", "main: Tag: Tag data Tag data"],
  };
  assert({ actual, expected });
}
