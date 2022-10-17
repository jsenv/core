// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/test/numeric-separators-style.mjs

import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

{
  const actual = inspect(0)
  const expected = "0"
  assert({ actual, expected })
}

{
  const actual = inspect(1)
  const expected = "1"
  assert({ actual, expected })
}

{
  const actual = inspect(-0)
  const expected = "-0"
  assert({ actual, expected })
}

{
  const actual = inspect(NaN)
  const expected = "NaN"
  assert({ actual, expected })
}

{
  const actual = inspect(Infinity)
  const expected = "Infinity"
  assert({ actual, expected })
}

{
  const actual = inspect(-Infinity)
  const expected = "-Infinity"
  assert({ actual, expected })
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = inspect(new Number(0))
  const expected = "Number(0)"
  assert({ actual, expected })
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = inspect(new Number(0), { parenthesis: true })
  const expected = "(Number(0))"
  assert({ actual, expected })
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = inspect(new Number(0), { useNew: true })
  const expected = "new Number(0)"
  assert({ actual, expected })
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = inspect(new Number(0), { parenthesis: true, useNew: true })
  const expected = "new (Number(0))"
  assert({ actual, expected })
}

// numeric separator - numbers
{
  const actual = inspect(1235)
  const expected = "1235"
  assert({ actual, expected })
}

{
  const actual = inspect(67000)
  const expected = "67_000"
  assert({ actual, expected })
}

{
  const actual = inspect(149600000)
  const expected = "149_600_000"
  assert({ actual, expected })
}

{
  const actual = inspect(1_464_301)
  const expected = "1_464_301"
  assert({ actual, expected })
}

// decimal
{
  const actual = inspect(1234.56)
  const expected = "1234.56"
  assert({ actual, expected })
}

{
  const actual = inspect(12345.67)
  const expected = "12_345.67"
  assert({ actual, expected })
}

{
  const actual = inspect(-0.120123)
  const expected = "-0.120_123"
  assert({ actual, expected })
}

// negative
{
  const actual = inspect(-1000001)
  const expected = "-1_000_001"
  assert({ actual, expected })
}

// exponential
{
  const actual = inspect(-1.23456e105)
  const expected = "-1.234_56e+105"
  assert({ actual, expected })
}

{
  const actual = inspect(-1200000e5)
  const expected = "-120_000_000_000"
  assert({ actual, expected })
}

{
  // prettier-ignore
  const actual = inspect(3.65432E12)
  const expected = "3_654_320_000_000"
  assert({ actual, expected })
}

// numeric separator - binary
{
  const actual = inspect(0b10101010101010)
  const expected = "10_922"
  assert({ actual, expected })
}

{
  // prettier-ignore
  const actual = inspect(0B10101010101010)
  const expected = "10_922"
  assert({ actual, expected })
}

// numeric separator - hexadecimal
{
  const actual = inspect(0xfabf00d)
  const expected = "262_926_349"
  assert({ actual, expected })
}

{
  // prettier-ignore
  const actual = inspect(0xABCDEF)
  // prettier-ignore
  const expected = "11_259_375"
  assert({ actual, expected })
}

// numeric separator - octal
{
  const actual = inspect(0o010101010101)
  const expected = "1_090_785_345"
  assert({ actual, expected })
}

{
  // prettier-ignore
  const actual = inspect(0O010101010101)
  const expected = "1_090_785_345"
  assert({ actual, expected })
}
