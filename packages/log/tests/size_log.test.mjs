import { assert } from "@jsenv/assert"

import { byteAsFileSize, byteAsMemoryUsage } from "@jsenv/log"

{
  const actual = byteAsFileSize(0)
  const expected = `0 B`
  assert({ actual, expected })
}
{
  const actual = byteAsFileSize(1)
  const expected = `1 B`
  assert({ actual, expected })
}
{
  const actual = byteAsFileSize(1000)
  const expected = `1 kB`
  assert({ actual, expected })
}
{
  const actual = byteAsFileSize(1110)
  const expected = `1.1 kB`
  assert({ actual, expected })
}
{
  const actual = byteAsFileSize(1010)
  const expected = `1 kB`
  assert({ actual, expected })
}

{
  const actual = byteAsMemoryUsage(1000)
  const expected = `1.0 kB`
  assert({ actual, expected })
}
{
  const actual = byteAsMemoryUsage(1100)
  const expected = `1.1 kB`
  assert({ actual, expected })
}
