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
  const test = (url) =>
    URL_META.urlChildMayMatch({
      url,
      associations: {
        whatever: {
          "file:///a/b/": 42,
        },
      },
      predicate: ({ whatever }) => whatever === 42,
    })
  const actual = {
    one: test("file:///a/"),
    two: test("file:///a/b/"),
    three: test("file:///a/c/"),
  }
  const expected = {
    one: true,
    two: true,
    three: false,
  }
  assert({ actual, expected })
}

{
  const test = (url) =>
    URL_META.urlChildMayMatch({
      url,
      associations: {
        whatever: {
          "file:///a/b*/c/": 42,
        },
      },
      predicate: ({ whatever }) => whatever === 42,
    })
  const actual = {
    one: test("file:///a/bZ/"),
    two: test("file:///a/bZ/c/"),
  }
  const expected = {
    one: true,
    two: true,
  }
  assert({ actual, expected })
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
  const test = (url) =>
    URL_META.urlChildMayMatch({
      url,
      associations: {
        whatever: {
          "file:///**/*.js": 42,
        },
      },
      predicate: ({ whatever }) => whatever === 42,
    })
  const actual = {
    one: test("file:///src/folder/"),
    two: test("file:///src/folder/subfolder/"),
  }
  const expected = {
    one: true,
    two: true,
  }
  assert({ actual, expected })
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

{
  const test = (url) =>
    URL_META.urlChildMayMatch({
      url,
      associations: {
        whatever: {
          "file:///**/node_modules/": false,
          "file:///**/.test.mjs": true,
        },
      },
      predicate: ({ whatever }) => whatever,
    })
  const actual = {
    a: test("file:///node_modules/"),
    b: test("file:///project/src/"),
    c: test("file:///project/node_modules/"),
  }
  const expected = {
    a: false,
    b: true,
    c: false,
  }
  assert({ actual, expected })
}
