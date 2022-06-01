import { assert } from "@jsenv/assert"

import { truncateToSignificantDecimals } from "@jsenv/log"

{
  const actual = truncateToSignificantDecimals(0.0101)
  const expected = 0.01
  assert({ actual, expected })
}

{
  const actual = truncateToSignificantDecimals(0.012)
  const expected = 0.01
  assert({ actual, expected })
}

{
  const actual = truncateToSignificantDecimals(0.016)
  const expected = 0.02
  assert({ actual, expected })
}

{
  const actual = truncateToSignificantDecimals(0.016556, {
    decimals: 3,
  })
  const expected = 0.0166
  assert({ actual, expected })
}

{
  const actual = truncateToSignificantDecimals(0)
  const expected = 0
  assert({ actual, expected })
}

{
  const actual = truncateToSignificantDecimals(-0.0015)
  const expected = -0.002
  assert({ actual, expected })
}
