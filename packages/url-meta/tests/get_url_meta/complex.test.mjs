import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/url-meta"

{
  const actual = URL_META.applyAssociations({
    url: "file:///file.es5.js/file.es5.js.map",
    associations: {
      js: {
        "file:///**/*.js": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///file.es5.js/file.es5.js.map",
    associations: {
      js: {
        "file:///**/*.js": true,
        "file:///**/*.js/**": false,
      },
    },
  })
  const expected = { js: false }
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///file.js.map",
    associations: {
      js: {
        "file:///**/*.js": true,
      },
    },
  })
  const expected = {}
  assert({ actual, expected })
}

{
  const associations = {
    format: {
      "file:///**/*.js": true,
      "file:///**/*.jsx": true,
      "file:///build": false,
      "file:///src/exception.js": false,
    },
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///index.js",
      associations,
    })
    const expected = { format: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/file.js",
      associations,
    })
    const expected = { format: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/folder/file.js",
      associations,
    })
    const expected = { format: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///index.test.js",
      associations,
    })
    const expected = { format: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/file.test.js",
      associations,
    })
    const expected = { format: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/folder/file.test.js",
      associations,
    })
    const expected = { format: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/exception.js",
      associations,
    })
    const expected = { format: false }
    assert({ actual, expected })
  }
}

{
  const associations = {
    cover: {
      "file:///index.js": true,
      "file:///src/**/*.js": true,
      "file:///src/**/*.jsx": true,
      "file:///**/*.test.js": false,
      "file:///**/*.test.jsx": false,
      "file:///build/": false,
      "file:///src/exception.js": false,
    },
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///index.js",
    })
    const expected = { cover: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/file.js",
    })
    const expected = { cover: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/folder/file.js",
    })
    const expected = { cover: true }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///index.test.js",
    })
    const expected = { cover: false }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/file.test.js",
    })
    const expected = { cover: false }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/folder/file.test.js",
    })
    const expected = { cover: false }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///build/index.js",
    })
    const expected = { cover: false }
    assert({ actual, expected })
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/exception.js",
    })
    const expected = { cover: false }
    assert({ actual, expected })
  }
}
