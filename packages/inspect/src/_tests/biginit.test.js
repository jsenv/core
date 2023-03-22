/* eslint-disable no-eval */
import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

{
  const value = BigInt(1)
  const actual = inspect(value)
  const expected = "1n"
  assert({ actual, expected })
}

{
  const value = 2n
  const actual = inspect(value)
  const expected = "2n"
  assert({ actual, expected })
}

{
  const value = Object(BigInt(1))
  const actual = inspect(value)
  const expected = "BigInt(1n)"
  assert({ actual, expected })
}

{
  const actual = inspect(1234567n)
  const expected = "1234567n"
  assert({ actual, expected })
}

{
  const actual = inspect(19223n)
  const expected = "19223n"
  assert({ actual, expected })
}
