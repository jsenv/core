import { assert } from "@jsenv/assert"

import { urlToOrigin } from "@jsenv/filesystem"

{
  const actual = urlToOrigin("http://example.com/dir/file.js?page=1")
  const expected = "http://example.com"
  assert({ actual, expected })
}

{
  const actual = urlToOrigin("file:///dir/file")
  const expected = "file://"
  assert({ actual, expected })
}

{
  const actual = urlToOrigin("file://C:\\dir\\file")
  const expected = "file://"
  assert({ actual, expected })
}
