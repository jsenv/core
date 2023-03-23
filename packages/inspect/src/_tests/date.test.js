import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

{
  const actual = inspect(new Date(10))
  const expected = `Date(10)`
  assert({ actual, expected })
}

{
  const nowMs = Date.now()
  const actual = inspect(new Date(nowMs))
  const expected = `Date(${nowMs})`
  assert({ actual, expected })
}
