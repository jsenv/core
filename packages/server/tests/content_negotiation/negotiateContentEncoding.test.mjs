import { assert } from "@jsenv/assert"

import { negotiateContentEncoding } from "@jsenv/server"

{
  const request = {
    headers: {
      "accept-encoding": "gzip, deflate",
    },
  }

  {
    const actual = negotiateContentEncoding(request, ["gzip"])
    const expected = "gzip"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentEncoding(request, ["deflate"])
    const expected = "deflate"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentEncoding(request, ["brotli"])
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
    const actual = negotiateContentEncoding(request, [
      "gzip",
      "deflate",
      "brotli",
    ])
    const expected = "brotli"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentEncoding(request, ["gzip", "deflate"])
    const expected = "gzip"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentEncoding(request, ["deflate"])
    const expected = "deflate"
    assert({ actual, expected })
  }
}
