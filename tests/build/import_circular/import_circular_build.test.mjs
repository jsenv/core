// https://github.com/rollup/rollup/tree/dba6f13132a1d7dac507d5056399d8af0eed6375/test/function/samples/preserve-modules-circular-order

import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";

const test = async (options) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    ...options,
  });
};

// default (with bundling)
{
  await test({
    plugins: [jsenvPluginBundling()],
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
  await test();
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import("./dist/main.js");
  const actual = { ...namespace };
  const expected = {
    executionOrder: ["index", "tag", "data", "main: Tag: Tag data Tag data"],
  };
  assert({ actual, expected });
}
