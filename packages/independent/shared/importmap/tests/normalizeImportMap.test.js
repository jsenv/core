import { assert } from "@jsenv/assert";
import { normalizeImportMap } from "@jsenv/importmap";

const actual = normalizeImportMap(
  {
    imports: {
      "../index.js": "main.js",
      "//domain.com/foo.js": "/bar.js",
      "http://domain.com/whatever.js": "./whatever.js",
    },
    scopes: {
      "foo/": {
        a: "./a",
      },
      "bar/": {
        a: "./b",
      },
    },
  },
  "https://example.com/folder/file.js",
);
const expected = {
  imports: {
    "http://domain.com/whatever.js": "https://example.com/folder/whatever.js",
    "https://example.com/index.js": "https://example.com/folder/main.js",
    "https://domain.com/foo.js": "https://example.com/bar.js",
  },
  scopes: {
    "https://example.com/folder/bar/": {
      a: "https://example.com/folder/b",
    },
    "https://example.com/folder/foo/": {
      a: "https://example.com/folder/a",
    },
  },
};
assert({ actual, expected });
