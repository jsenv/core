import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/url-meta"

{
  const url = "file:///file"
  const associations = {
    "/file": true,
  }
  try {
    URL_META.applyAssociations({
      url,
      associations,
    })
  } catch (actual) {
    const expected = new TypeError(
      `all associations value must be objects, found "/file": true`,
    )
    assert({ actual, expected })
  }
}

{
  const url = "file:///"
  const associations = {
    "file:///foo": true,
  }
  try {
    URL_META.applyAssociations({
      url,
      associations,
    })
  } catch (actual) {
    const expected = new TypeError(
      `all associations value must be objects, found "file:///foo": true`,
    )
    assert({ actual, expected })
  }
}

{
  const url = "file:///file"
  const associations = {
    whatever: {
      "file:///*.js": true,
      "file:///file.js": null,
    },
  }
  const actual = URL_META.applyAssociations({
    url,
    associations,
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///",
    associations: {
      a: {
        "file:///foo": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///foo",
    associations: {
      a: {
        "file:///foo": true,
      },
    },
  })
  const expected = { a: true }
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a",
    associations: {
      a: {
        "file:///a": true,
      },
    },
  })
  const expected = { a: true }
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a.js",
    associations: {
      a: {
        "file:///a": true,
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
        "file:///a": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/b.js",
    associations: {
      a: {
        "file:///a": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/a",
    associations: {
      a: {
        "file:///b/a": true,
      },
    },
  })
  const expected = { a: true }
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/a.js",
    associations: {
      a: {
        "file:///b/a": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/c",
    associations: {
      a: {
        "file:///b/a": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/a/c",
    associations: {
      a: {
        "file:///b/a": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///dist",
    associations: {
      a: {
        "file:///dist": 0,
      },
    },
  })
  const expected = { a: 0 }
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/dist",
    associations: {
      a: {
        "file:///dist": 0,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

// ensure getUrlMeta overrides in order (without sorting specifier keys by length)
{
  const actual = URL_META.applyAssociations({
    url: "file:///abcd/",
    associations: {
      whatever: {
        "file:///a*/": 41,
        "file:///abcd/": 42,
      },
    },
  })
  const expected = { whatever: 42 }
  assert({ actual, expected })
}
