import { assert } from "@jsenv/assert"

import { urlToPathname } from "@jsenv/filesystem"

{
  const actual = urlToPathname("http://example.com/dir/file.js?page=1")
  const expected = "/dir/file.js"
  assert({ actual, expected })
}

{
  const actual = urlToPathname("http://example.com/dir/")
  const expected = "/dir/"
  assert({ actual, expected })
}

{
  const actual = urlToPathname("http://example.com/")
  const expected = "/"
  assert({ actual, expected })
}

{
  const actual = urlToPathname("file:///dir/file.js?page=1")
  const expected = "/dir/file.js"
  assert({ actual, expected })
}

{
  const actual = urlToPathname("file:///dir/file.js?page=1#foo")
  const expected = "/dir/file.js"
  assert({ actual, expected })
}

{
  const actual = urlToPathname("file:///dir/file.js#foo")
  const expected = "/dir/file.js"
  assert({ actual, expected })
}

{
  const actual = urlToPathname("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf")
  const expected = "d3958f5c-0777-0845-9dcf-2cb28783acaf"
  assert({ actual, expected })
}
