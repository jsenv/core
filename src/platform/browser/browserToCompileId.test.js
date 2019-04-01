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
        compatibility: {
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
        compatibility: {
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
        compatibility: {
          chrome: "41",
        },
      },
    },
  )
  const expected = null
  assert.deepEqual(actual, expected)
}
