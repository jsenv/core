// https://github.com/rollup/rollup/tree/dba6f13132a1d7dac507d5056399d8af0eed6375/test/function/samples/preserve-modules-circular-order

import { takeDirectorySnapshot } from "@jsenv/snapshots";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";

const test = async ({ name, ...params }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
};

// default (with bundling)
{
  await test({
    name: "0_with_bundling",
    minification: false,
  });
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import("./dist/main.js");
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
    bundling: false,
    minification: false,
  });
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import("./dist/main.js");
  const actual = { ...namespace };
  const expected = {
    executionOrder: ["index", "tag", "data", "main: Tag: Tag data Tag data"],
  };
  assert({ actual, expected });
}
