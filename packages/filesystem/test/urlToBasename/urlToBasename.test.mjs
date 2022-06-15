import { assert } from "@jsenv/assert"

import { urlToBasename } from "@jsenv/filesystem"

{
  const actual = urlToBasename("http://example.com/dir/file.js?page=1")
  const expected = "file"
  assert({ actual, expected })
}

{
  const actual = urlToBasename("http://example.com/dir/file.")
  const expected = "file"
  assert({ actual, expected })
}

{
  const actual = urlToBasename("http://example.com/dir/file")
  const expected = "file"
  assert({ actual, expected })
}

{
  const actual = urlToBasename("http://example.com/dir/")
  const expected = "dir"
  assert({ actual, expected })
}

{
  const actual = urlToBasename("http://example.com/")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToBasename("file:///dir/file.js?page=1")
  const expected = "file"
  assert({ actual, expected })
}

{
  const actual = urlToBasename("file:///dir/?page=1")
  const expected = "dir"
  assert({ actual, expected })
}

{
  const actual = urlToBasename("file:///?page=1")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToBasename("file://?page=1")
  const expected = ""
  assert({ actual, expected })
}

{
  const actual = urlToBasename("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf")
  const expected = "d3958f5c-0777-0845-9dcf-2cb28783acaf"
  assert({ actual, expected })
}
