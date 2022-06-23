import { assert } from "@jsenv/assert"

import { urlToExtension } from "@jsenv/urls"

{
  const actual = urlToExtension("http://example.com/dir/file.js?page=1")
  const expected = ".js"
  assert({ actual, expected })
}

{
  const actual = urlToExtension("http://example.com/dir/file.")
  const expected = "."
  assert({ actual, expected })
}

{
  const actual = urlToExtension("http://example.com/dir/file")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToExtension("http://example.com/dir/")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToExtension("http://example.com/")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToExtension("file:///dir/file.js?page=1")
  const expected = ".js"
  assert({ actual, expected })
}

{
  const actual = urlToExtension("file:///dir/?page=1")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToExtension("file:///?page=1")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToExtension("file://?page=1")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToExtension("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf")
  const expected = ""
  assert({ actual, expected })
}
