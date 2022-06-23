// https://github.com/rollup/rollup/tree/dba6f13132a1d7dac507d5056399d8af0eed6375/test/function/samples/preserve-modules-circular-order

import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

const test = async (options) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    minification: false,
    ...options,
  })
}

// default (with bundling)
{
  await test()
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import("./dist/main.js")
  const actual = { ...namespace }
  const expected = {
    executionOrder: ["index", "tag", "data", "main: Tag: Tag data Tag data"],
  }
  assert({ actual, expected })
}

// without bundling
{
  await test({ bundling: false })
  // eslint-disable-next-line import/no-unresolved
  const namespace = await import("./dist/main.js")
  const actual = { ...namespace }
  const expected = {
    executionOrder: ["index", "tag", "data", "main: Tag: Tag data Tag data"],
  }
  assert({ actual, expected })
}
