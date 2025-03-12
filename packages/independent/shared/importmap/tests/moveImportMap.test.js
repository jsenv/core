import { assert } from "@jsenv/assert";
import { moveImportMap } from "@jsenv/importmap";

// move up
{
  const importMap = {
    imports: {
      "./dir/foo.js": "../bar.js",
    },
  };
  const actual = moveImportMap(
    importMap,
    "file:///project/test/dist/",
    "file:///project/test/",
  );
  const expected = {
    imports: {
      "./dist/dir/foo.js": "./bar.js",
    },
  };
  assert({ actual, expected });
}

// move down
{
  const importMap = {
    imports: {
      "./dist/dir/foo.js": "./bar.js",
    },
  };
  const actual = moveImportMap(
    importMap,
    "file:///project/test/",
    "file:///project/test/dist/",
  );
  const expected = {
    imports: {
      "./dir/foo.js": "../bar.js",
    },
  };
  assert({ actual, expected });
}

// no move
{
  const importMap = {
    imports: {
      "./dir/foo.js": "../bar.js",
    },
  };
  const actual = moveImportMap(
    importMap,
    "file:///project/test/dist/",
    "file:///project/test/dist/",
  );
  const expected = importMap;
  assert({ actual, expected });
}

// with scopes
{
  const importMap = {
    imports: {
      foo: "./bar.js",
    },
    scopes: {
      "./dir/": {
        hey: "../hey.js",
      },
    },
  };
  const actual = moveImportMap(
    importMap,
    "http://example.com/test/project.importmap",
    "http://example.com/project.importmap",
  );
  const expected = {
    imports: {
      foo: "./test/bar.js",
    },
    scopes: {
      "./test/dir/": {
        hey: "./hey.js",
      },
    },
  };
  assert({ actual, expected });
}
