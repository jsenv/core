import { assert } from "@dmail/assert"
import { browserToCompileId } from "./browserToCompileId.js"

{
  const actual = browserToCompileId(
    {
      name: "chrome",
      version: "39",
    },
    {
      foo: {
        platformCompatMap: {
          chrome: "41",
        },
      },
    },
  )
  const expected = "foo"
  assert({ actual, expected })
}

{
  const actual = browserToCompileId(
    {
      name: "chrome",
      version: "41",
    },
    {
      foo: {
        platformCompatMap: {
          chrome: "41",
        },
      },
    },
  )
  const expected = null
  assert({ actual, expected })
}

{
  const actual = browserToCompileId(
    {
      name: "chrome",
      version: "42",
    },
    {
      foo: {
        platformCompatMap: {
          chrome: "41",
        },
      },
    },
  )
  const expected = null
  assert({ actual, expected })
}
