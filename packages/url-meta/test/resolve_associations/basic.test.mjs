import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/url-meta"

{
  const actual = URL_META.resolveAssociations(
    {
      whatever: {
        "./a.js": true,
        "http://example.com/file.js": true,
      },
    },
    "file:///User/name/directory/",
  )
  const expected = {
    whatever: {
      "file:///User/name/directory/a.js": true,
      "http://example.com/file.js": true,
    },
  }
  assert({ actual, expected })
}

// ensure resolveAssociations does not sort by length
{
  const actual = URL_META.resolveAssociations(
    {
      whatever: {
        "./a.js": 42,
        "./long.js": 42,
      },
    },
    "file:///",
  )
  const expected = {
    whatever: {
      "file:///a.js": 42,
      "file:///long.js": 42,
    },
  }
  assert({ actual, expected })
}
