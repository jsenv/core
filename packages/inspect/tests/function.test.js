import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

// const arrowFunctionSupported = (() => {}).prototype === null

{
  const actual = inspect(function () {})
  const expected = `function () {/* hidden */}`
  assert({ actual, expected })
}

{
  const actual = inspect(function () {}, { showFunctionBody: true })
  const expected = "function () {}"
  assert({ actual, expected })
}

{
  const value = function () {
    return true
  }
  const actual = inspect(value, { showFunctionBody: true })
  const expected = value.toString()
  assert({ actual, expected })
}

function named(a) {
  return a
}
{
  const actual = inspect(named)
  const expected = `function named() {/* hidden */}`
  assert({ actual, expected })
}
{
  const actual = inspect(named, { showFunctionBody: true })
  const expected = named.toString()
  assert({ actual, expected })
}

{
  const nested = {
    // eslint-disable-next-line object-shorthand
    function: function () {},
  }
  const actual = inspect(nested)
  const expected = `{
  "function": function () {/* hidden */}
}`
  assert({ actual, expected })
}
