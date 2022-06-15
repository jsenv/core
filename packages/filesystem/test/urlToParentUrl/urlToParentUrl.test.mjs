import { assert } from "@jsenv/assert"

import { urlToParentUrl } from "@jsenv/filesystem"

{
  const actual = urlToParentUrl("http://example.com/dir/file.js?page=1")
  const expected = "http://example.com/dir/"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("http://example.com/dir/")
  const expected = "http://example.com/"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("http://example.com/")
  const expected = "http://example.com/"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("http://example.com")
  const expected = "http://example.com"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("http://example.com?page=1")
  const expected = "http://example.com?page=1"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("file:///dir/file.js?page=1")
  const expected = "file:///dir/"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("file:///dir/")
  const expected = "file:///"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("file:///")
  const expected = "file:///"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("file://")
  const expected = "file://"
  assert({ actual, expected })
}

{
  const actual = urlToParentUrl("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf")
  const expected = "blob:d3958f5c-0777-0845-9dcf-2cb28783acaf"
  assert({ actual, expected })
}
