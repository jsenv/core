import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

{
  const actual = inspect(true)
  const expected = "true"
  assert({ actual, expected })
}

{
  const actual = inspect(false)
  const expected = "false"
  assert({ actual, expected })
}

/* eslint-disable no-new-wrappers */
{
  const actual = inspect(new Boolean(true))
  const expected = "Boolean(true)"
  assert({ actual, expected })
}

{
  const actual = inspect(new Boolean(true), { parenthesis: true })
  const expected = "(Boolean(true))"
  assert({ actual, expected })
}

{
  const actual = inspect(new Boolean(true), { useNew: true })
  const expected = "new Boolean(true)"
  assert({ actual, expected })
}

{
  const actual = inspect(new Boolean(true), { parenthesis: true, useNew: true })
  const expected = "new (Boolean(true))"
  assert({
    actual,
    expected,
  })
}
