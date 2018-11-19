// won't work because rollup needs path to @dmail/project-structure-compile-babel/src/versionCompare.js
// but we will no support export token
import assert from "assert"
import { browserToCompileId } from "./browserToCompileId.js"

{
  const actual = browserToCompileId(
    {
      name: "chrome",
      version: "39",
    },
    {
      foo: {
        compatMap: {
          chrome: "41",
        },
      },
    },
  )
  const expected = "foo"
  assert.deepEqual(actual, expected)
}

{
  const actual = browserToCompileId(
    {
      name: "chrome",
      version: "41",
    },
    {
      foo: {
        compatMap: {
          chrome: "41",
        },
      },
    },
  )
  const expected = null
  assert.deepEqual(actual, expected)
}

{
  const actual = browserToCompileId(
    {
      name: "chrome",
      version: "42",
    },
    {
      foo: {
        compatMap: {
          chrome: "41",
        },
      },
    },
  )
  const expected = null
  assert.deepEqual(actual, expected)
}

console.log("passed")
