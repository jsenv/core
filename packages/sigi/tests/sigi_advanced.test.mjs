import { assert } from "@jsenv/assert"
import { sigi } from "@jsenv/sigi"

// warning when mutate changes the type
{
  const consoleWarnings = []
  const { warn } = console
  console.warn = (warning) => {
    consoleWarnings.push(warning)
  }
  try {
    const { mutate } = sigi({ isLogged: true })
    mutate({ isLogged: 1 })
    const actual = consoleWarnings
    const expected = [
      `A value type will change from "boolean" to "number" at state.isLogged`,
    ]
    assert({ actual, expected })
  } finally {
    console.warn = warn
  }
}

// preventExtensions is respected
{
  const { mutate } = sigi(Object.preventExtensions({ foo: true }))
  try {
    mutate({ bar: true })
    throw new Error("should throw")
  } catch (e) {
    const actual = e
    const expected = new TypeError(
      `Cannot define property bar, object is not extensible`,
    )
    assert({ actual, expected })
  }
}
