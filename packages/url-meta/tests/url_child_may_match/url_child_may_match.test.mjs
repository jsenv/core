import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/url-meta"

{
  const actual = URL_META.urlChildMayMatch({
    url: "file:///.github/",
    associations: {
      source: {
        "file:///**/.github/": true,
        "file:///**/.git/": false,
      },
    },
    predicate: ({ source }) => source,
  })
  const expected = true
  assert({ actual, expected })
}

{
  const associations = {
    whatever: {
      "file:///a/b/": 42,
    },
  }

  {
    const actual = URL_META.urlChildMayMatch({
      url: "file:///a/",
      associations,
      predicate: ({ whatever }) => whatever === 42,
    })
    const expected = true
    assert({ actual, expected })
  }
  {
    const actual = URL_META.urlChildMayMatch({
      url: "file:///a/b/",
      associations,
      predicate: ({ whatever }) => whatever === 42,
    })
    const expected = true
    assert({ actual, expected })
  }
  {
    const actual = URL_META.urlChildMayMatch({
      url: "file:///a/c/",
      associations,
      predicate: ({ whatever }) => whatever === 42,
    })
    const expected = false
    assert({ actual, expected })
  }
}

{
  const associations = {
    whatever: {
      "file:///a/b*/c/": 42,
    },
  }

  {
    const actual = URL_META.urlChildMayMatch({
      url: "file:///a/bZ/",
      associations,
      predicate: ({ whatever }) => whatever === 42,
    })
    const expected = true
    assert({ actual, expected })
  }
  {
    const actual = URL_META.urlChildMayMatch({
      url: "file:///a/bZ/c/",
      associations,
      predicate: ({ whatever }) => whatever === 42,
    })
    const expected = true
    assert({ actual, expected })
  }
}

{
  const actual = URL_META.urlChildMayMatch({
    url: "file:///a/b/c/",
    associations: {
      whatever: {
        "file:///a/**/b.js": 42,
      },
    },
    predicate: ({ whatever }) => whatever === 42,
  })
  const expected = true
  assert({ actual, expected })
}

{
  const actual = URL_META.urlChildMayMatch({
    url: "file:///node_modules/",
    associations: {
      whatever: {
        "file:///**/*": 42,
        "file:///node_modules/": 43,
      },
    },
    predicate: ({ whatever }) => whatever === 42,
  })
  const expected = false
  assert({ actual, expected })
}

{
  const actual = URL_META.urlChildMayMatch({
    url: "file:///src/",
    associations: {
      whatever: {
        "file:///**/*.js": 42,
        "file:///**/*.md": 43,
      },
    },
    predicate: ({ whatever }) => whatever === 42,
  })
  const expected = true
  assert({ actual, expected })
}

{
  const associations = {
    whatever: {
      "file:///**/*.js": 42,
    },
  }

  {
    const actual = URL_META.urlChildMayMatch({
      url: "file:///src/folder/",
      associations,
      predicate: ({ whatever }) => whatever === 42,
    })
    const expected = true
    assert({ actual, expected })
  }
  {
    const actual = URL_META.urlChildMayMatch({
      url: "file:///src/folder/subfolder/",
      associations,
      predicate: ({ whatever }) => whatever === 42,
    })
    const expected = true
    assert({ actual, expected })
  }
}

{
  const actual = URL_META.urlChildMayMatch({
    url: "file:///src/jsCreateCompileService/compile/",
    associations: {
      whatever: {
        "file:///src/**/*.js": 42,
      },
    },
    predicate: ({ whatever }) => whatever === 42,
  })
  const expected = true
  assert({ actual, expected })
}

{
  const test = (url) =>
    URL_META.urlChildMayMatch({
      url,
      associations: {
        whatever: {
          "file:///**/*": true,
          "file:///**/.*": false,
          "file:///**/.*/": false,
          "file:///**/node_modules/": false,
        },
      },
      predicate: ({ whatever }) => whatever,
    })
  const actual = {
    appDirectory: test("file:///app/"),
    nodeModuleDirectory: test("file:///node_modules/"),
    gitDirectory: test("file:///.git/"),
  }
  const expected = {
    appDirectory: true,
    nodeModuleDirectory: false,
    gitDirectory: false,
  }
  assert({ actual, expected })
}
