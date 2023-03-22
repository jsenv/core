import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

{
  const actual = inspect(Symbol())
  const expected = "Symbol()"
  assert({ actual, expected })
}

{
  const actual = inspect(Symbol("foo"))
  const expected = `Symbol("foo")`
  assert({ actual, expected })
}

{
  const actual = inspect(Symbol(42))
  const expected = `Symbol("42")`
  assert({ actual, expected })
}
