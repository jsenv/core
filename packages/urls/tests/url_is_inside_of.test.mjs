import { assert } from "@jsenv/assert"

import { urlIsInsideOf } from "@jsenv/urls"

// different origins
{
  const actual = urlIsInsideOf(
    "http://example.com/directory/file.js",
    "http://example.fr/directory/",
  )
  const expected = false
  assert({ actual, expected })
}

// same urls
{
  const actual = urlIsInsideOf(
    "file:///directory/file.js",
    "file:///directory/file.js",
  )
  const expected = false
  assert({ actual, expected })
}

// outside
{
  const actual = urlIsInsideOf("file:///whatever/file.js", "file:///directory/")
  const expected = false
  assert({ actual, expected })
}

// inside
{
  const actual = urlIsInsideOf(
    "file:///directory/file.js",
    "file:///directory/",
  )
  const expected = true
  assert({ actual, expected })
}

// deep inside
{
  const actual = urlIsInsideOf(
    "file:///directory/subdirectory/file.js",
    "file:///directory/",
  )
  const expected = true
  assert({ actual, expected })
}
