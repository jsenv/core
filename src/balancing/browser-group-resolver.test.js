import { assert } from "@dmail/assert"
import { resolveBrowserGroup } from "./browser-group-resolver.js"

{
  const actual = resolveBrowserGroup(
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
  const actual = resolveBrowserGroup(
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
  const actual = resolveBrowserGroup(
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
