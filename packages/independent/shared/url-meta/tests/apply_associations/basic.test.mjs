import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

// composition
{
  const actual = URL_META.applyAssociations({
    url: "file:///foo.js",
    associations: {
      node: {
        "file:///**/*.js": {
          foo: true,
        },
        "file:///foo.js": {
          bar: true,
        },
      },
    },
  });
  const expect = {
    node: {
      foo: true,
      bar: true,
    },
  };
  assert({ actual, expect });
}

try {
  URL_META.applyAssociations({
    url: ["*$^="],
  });
  throw new Error("shoud crash");
} catch (error) {
  const actual = error;
  const expect = new TypeError(`url must be a url string, got *$^=`);
  assert({ actual, expect });
}

// associate "foo.js" to { a: true }
{
  const test = (url) =>
    URL_META.applyAssociations({
      url,
      associations: {
        a: {
          "file:///foo.js": true,
        },
      },
    });
  const actual = {
    fooJs: test("file:///foo.js"),
    fileJs: test("file:///file.js"),
  };
  const expect = {
    fooJs: { a: true },
    fileJs: {},
  };
  assert({ actual, expect });
}

// associate "*.js" to {whatever: true}
// and "file.js" to {whatever: null}
{
  const test = (url) =>
    URL_META.applyAssociations({
      url,
      associations: {
        whatever: {
          "file:///*.js": true,
          "file:///file.js": null,
        },
      },
    });
  const actual = {
    file: test("file:///file"),
    fooJs: test("file:///foo.js"),
    fileJs: test("file:///file.js"),
  };
  const expect = {
    file: {},
    fooJs: { whatever: true },
    fileJs: { whatever: null },
  };
  assert({ actual, expect });
}

// ignore associations that are not plain object
{
  const test = (url) =>
    URL_META.applyAssociations({
      url,
      associations: {
        whatever: null,
      },
    });
  const actual = test("file:///file.js");
  const expect = {};
  assert({ actual, expect });
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
  });
  const expect = { whatever: 42 };
  assert({ actual, expect });
}

{
  const test = (url) =>
    URL_META.applyAssociations({
      url,
      associations: {
        whatever: {
          "file:///**/*": true,
          "file:///**/.*": false,
          "file:///**/.*/": false,
          "file:///**/node_modules/": false,
        },
      },
    });
  const actual = {
    jsFile: test("file:///a.js"),
    gitignore: test("file:///.gitignore"),
    nodeModuleFile: test("file:///node_modules/a.js"),
    insideGitDirectory: test("file:///.git/a.js"),
  };
  const expect = {
    jsFile: { whatever: true },
    gitignore: { whatever: false },
    nodeModuleFile: { whatever: false },
    insideGitDirectory: { whatever: false },
  };
  assert({ actual, expect });
}

{
  const test = (url) =>
    URL_META.applyAssociations({
      url,
      associations: {
        a: {
          "file:///foo": true,
        },
      },
    });
  const actual = test("file:///");
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a",
    associations: {
      a: {
        "file:///a": true,
      },
    },
  });
  const expect = { a: true };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a.js",
    associations: {
      a: {
        "file:///a": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/b",
    associations: {
      a: {
        "file:///a": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/b.js",
    associations: {
      a: {
        "file:///a": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/a",
    associations: {
      a: {
        "file:///b/a": true,
      },
    },
  });
  const expect = { a: true };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/a.js",
    associations: {
      a: {
        "file:///b/a": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/c",
    associations: {
      a: {
        "file:///b/a": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///b/a/c",
    associations: {
      a: {
        "file:///b/a": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///dist",
    associations: {
      a: {
        "file:///dist": 0,
      },
    },
  });
  const expect = { a: 0 };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///a/dist",
    associations: {
      a: {
        "file:///dist": 0,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const test = (url) =>
    URL_META.applyAssociations({
      url,
      associations: {
        a: {
          "file:///**/*": true,
          "file:///**/.*": false,
        },
      },
    });
  const actual = {
    jsFile: test("file:///main.js"),
    gitIgnore: test("file:///.gitignore"),
  };
  const expect = {
    jsFile: { a: true },
    gitIgnore: { a: false },
  };
  assert({ actual, expect });
}
