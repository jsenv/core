import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

{
  const actual = inspect(new Error("here"))
  const expected = `Error("here")`
  assert({ actual, expected })
}

{
  const actual = inspect(new RangeError("here"))
  const expected = `RangeError("here")`
  assert({ actual, expected })
}

{
  const actualError = new Error("hello")
  Object.defineProperty(actualError, "bar", {
    enumerable: false,
    value: "bar",
  })
  const actual = inspect(actualError)
  const expected = `Error("hello")`
  assert({ actual, expected })
}

{
  const error = new Error()
  error.name = "AssertionError"
  const actual = inspect(error)
  const expected = `Error("")`
  assert({ actual, expected })
}
