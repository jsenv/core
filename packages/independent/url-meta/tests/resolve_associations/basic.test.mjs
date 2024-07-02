import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const actual = URL_META.resolveAssociations(
    {
      whatever: {
        "./a.js": true,
        "http://example.com/file.js": true,
      },
    },
    "file:///User/name/directory/",
  );
  const expect = {
    whatever: {
      "file:///User/name/directory/a.js": true,
      "http://example.com/file.js": true,
    },
  };
  assert({ actual, expect });
}

{
  const actual = URL_META.resolveAssociations(
    {
      a: {
        "a.js": true,
      },
      whatever: null,
    },
    "file:///",
  );
  const expect = {
    a: { "file:///a.js": true },
    whatever: null,
  };
  assert({ actual, expect });
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
  );
  const expect = {
    whatever: {
      "file:///a.js": 42,
      "file:///long.js": 42,
    },
  };
  assert({ actual, expect });
}

{
  const associations = URL_META.resolveAssociations(
    {
      whatever: {
        "**/*": true,
        "**/.*": false,
        "**/.*/": false,
        "**/node_modules/": false,
      },
    },
    "file:///src/",
  );
  const test = (url) =>
    URL_META.applyAssociations({
      url,
      associations,
    });
  const actual = {
    jsFile: test("file:///src/a.js"),
    gitignore: test("file:///src/.gitignore"),
    nodeModuleFile: test("file:///src/node_modules/a.js"),
    insideGitDirectory: test("file:///src/.git/a.js"),
  };
  const expect = {
    jsFile: { whatever: true },
    gitignore: { whatever: false },
    nodeModuleFile: { whatever: false },
    insideGitDirectory: { whatever: false },
  };
  assert({ actual, expect });
}
