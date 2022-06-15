import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/urls"

{
  const actual = URL_META.applyAssociations({
    url: "file:///a",
    associations: {
      a: {
        "file:///**/a/**": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/b",
    associations: {
      a: {
        "file:///**/a/**": true,
      },
    },
  })
  const expected = { a: true }
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/a/c",
    associations: {
      a: {
        "file:///**/a/**": true,
      },
    },
  })
  const expected = { a: true }
  assert({ actual, expected })
}
