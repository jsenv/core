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
  const expect = {
    imports: {
      "./dist/dir/foo.js": "./bar.js",
    },
  };
  assert({ actual, expect });
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
  const expect = {
    imports: {
      "./dir/foo.js": "../bar.js",
    },
  };
  assert({ actual, expect });
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
  const expect = importMap;
  assert({ actual, expect });
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
  const expect = {
    imports: {
      foo: "./test/bar.js",
    },
    scopes: {
      "./test/dir/": {
        hey: "./hey.js",
      },
    },
  };
  assert({ actual, expect });
}
