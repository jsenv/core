import { assert } from "@jsenv/assert"

import { urlToResource } from "@jsenv/urls"

{
  const actual = urlToResource("http://example.com/dir/file.js?page=1")
  const expected = "/dir/file.js?page=1"
  assert({ actual, expected })
}

{
  const actual = urlToResource("http://example.com/dir/?foo=bar#10")
  const expected = "/dir/?foo=bar#10"
  assert({ actual, expected })
}

{
  const actual = urlToResource("http://example.com/")
  const expected = "/"
  assert({ actual, expected })
}

{
  const actual = urlToResource("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf")
  const expected = "d3958f5c-0777-0845-9dcf-2cb28783acaf"
  assert({ actual, expected })
}

{
  const actual = urlToResource("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf")
  const expected = "d3958f5c-0777-0845-9dcf-2cb28783acaf"
  assert({ actual, expected })
}

{
  const actual = urlToResource("file://C:\\dir\\file")
  const expected = "C:\\dir\\file"
  assert({ actual, expected })
}
