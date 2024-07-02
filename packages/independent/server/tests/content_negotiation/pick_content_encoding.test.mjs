import { assert } from "@jsenv/assert";

import { pickContentEncoding } from "@jsenv/server";

{
  const request = {
    headers: {
      "accept-encoding": "gzip, deflate",
    },
  };

  {
    const actual = pickContentEncoding(request, ["gzip"]);
    const expect = "gzip";
    assert({ actual, expect });
  }
  {
    const actual = pickContentEncoding(request, ["deflate"]);
    const expect = "deflate";
    assert({ actual, expect });
  }
  {
    const actual = pickContentEncoding(request, ["brotli"]);
    const expect = null;
    assert({ actual, expect });
  }
}

{
  const request = {
    headers: {
      "accept-encoding": "br;q=1.0, gzip;q=0.8, *;q=0.1",
    },
  };

  {
    const actual = pickContentEncoding(request, ["gzip", "deflate", "brotli"]);
    const expect = "brotli";
    assert({ actual, expect });
  }
  {
    const actual = pickContentEncoding(request, ["gzip", "deflate"]);
    const expect = "gzip";
    assert({ actual, expect });
  }
  {
    const actual = pickContentEncoding(request, ["deflate"]);
    const expect = "deflate";
    assert({ actual, expect });
  }
}
