import { assert } from "@jsenv/assert"

import { pickContentEncoding } from "@jsenv/server"

{
  const request = {
    headers: {
      "accept-encoding": "gzip, deflate",
    },
  }

  {
    const actual = pickContentEncoding(request, ["gzip"])
    const expected = "gzip"
    assert({ actual, expected })
  }
  {
    const actual = pickContentEncoding(request, ["deflate"])
    const expected = "deflate"
    assert({ actual, expected })
  }
  {
    const actual = pickContentEncoding(request, ["brotli"])
    const expected = null
    assert({ actual, expected })
  }
}

{
  const request = {
    headers: {
      "accept-encoding": "br;q=1.0, gzip;q=0.8, *;q=0.1",
    },
  }

  {
    const actual = pickContentEncoding(request, ["gzip", "deflate", "brotli"])
    const expected = "brotli"
    assert({ actual, expected })
  }
  {
    const actual = pickContentEncoding(request, ["gzip", "deflate"])
    const expected = "gzip"
    assert({ actual, expected })
  }
  {
    const actual = pickContentEncoding(request, ["deflate"])
    const expected = "deflate"
    assert({ actual, expected })
  }
}
