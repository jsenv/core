import { assert } from "@jsenv/assert"

import { msAsDuration } from "@jsenv/log"

{
  const actual = msAsDuration(0.1)
  const expected = `0 second`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(1.02)
  const expected = `0.001 second`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(1.52)
  const expected = `0.002 second`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(52)
  const expected = `0.05 second`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(55)
  const expected = `0.06 second`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(99)
  const expected = `0.1 second`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(999)
  const expected = `1 second`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(1_421)
  const expected = `1.4 seconds`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(61_421)
  const expected = `1 minute and 1 second`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(1_421)
  const expected = `1.4 seconds`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(3_601_200)
  const expected = `1 hour`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(7_651_200)
  const expected = `2 hours and 8 minutes`
  assert({ actual, expected })
}

{
  const actual = msAsDuration(2200, {
    meaningfulMs: 1000,
    secondMaxDecimals: 0,
  })
  const expected = "2 seconds"
  assert({ actual, expected })
}
