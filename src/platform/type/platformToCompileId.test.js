// won't work because rollup needs path to @dmail/project-structure-compile-babel/src/versionCompare.js
// but we will no support export token
import { platformToCompileId } from "./platformToCompileId.js"
import assert from "assert"

{
  const actual = platformToCompileId({
    compatMap: {
      foo: {
        chrome: "41",
      },
    },
    defaultId: "bar",
    platformName: "chrome",
    platformVersion: "39",
  })
  const expected = "foo"
  assert.deepEqual(actual, expected)
}

{
  const actual = platformToCompileId({
    compatMap: {
      foo: {
        chrome: "41",
      },
    },
    defaultId: "bar",
    platformName: "chrome",
    platformVersion: "41",
  })
  const expected = "bar"
  assert.deepEqual(actual, expected)
}

{
  const actual = platformToCompileId({
    compatMap: {
      foo: {
        chrome: "41",
      },
    },
    defaultId: "bar",
    platformName: "chrome",
    platformVersion: "42",
  })
  const expected = "bar"
  assert.deepEqual(actual, expected)
}

console.log("passed")
