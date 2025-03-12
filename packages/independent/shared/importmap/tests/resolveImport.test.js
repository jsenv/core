import { assert } from "@jsenv/assert";
import { resolveImport } from "@jsenv/importmap";

// remap basic
{
  const actual = resolveImport({
    specifier: "/whatever/foo.js",
    importer: `http://example.com/folder/file.js`,
    importMap: {
      scopes: {
        [`http://example.com/folder/`]: {
          [`http://example.com/whatever/`]: `http://example.com/remapped/`,
        },
      },
    },
  });
  const expected = `http://example.com/remapped/foo.js`;
  assert({ actual, expected });
}

// http
{
  const actual = resolveImport({
    specifier: "https://code.jquery.com/jquery-3.3.1.min.js",
    importer: import.meta.url,
  });
  const expected = "https://code.jquery.com/jquery-3.3.1.min.js";
  assert({ actual, expected });
}

// file
{
  const actual = resolveImport({
    specifier: "file:///Users/file.js",
    importer: import.meta.url,
  });
  const expected = "file:///Users/file.js";
  assert({ actual, expected });
}

// bare + importer file
{
  const actual = resolveImport({
    specifier: "foo",
    importer: `file:///C:/folder/file.js`,
    defaultExtension: false,
  });
  const expected = `file:///C:/folder/foo`;
  assert({ actual, expected });
}

// bare remapped
{
  const origin = "http://example.com";
  const actual = resolveImport({
    specifier: "foo",
    importer: origin,
    importMap: {
      imports: {
        foo: `${origin}/node_modules/foo/src/foo.js`,
      },
    },
  });
  const expected = `${origin}/node_modules/foo/src/foo.js`;
  assert({ actual, expected });
}

// bar remapped 2
{
  const origin = "http://example.com";
  const actual = resolveImport({
    specifier: "foo/src/foo.js",
    importer: origin,
    importMap: {
      imports: {
        "foo/": `${origin}/node_modules/foo/`,
      },
    },
  });
  const expected = `${origin}/node_modules/foo/src/foo.js`;
  assert({ actual, expected });
}

// extension on origin
{
  const actual = resolveImport({
    specifier: "../",
    importer: "http://example.com/folder/file.js",
    defaultExtension: ".js",
  });
  const expected = "http://example.com/";
  assert({ actual, expected });
}

// extension on directory
{
  const actual = resolveImport({
    specifier: "../",
    importer: "https://domain.com/folder/subfolder/file.js",
    defaultExtension: ".js",
  });
  const expected = "https://domain.com/folder/";
  assert({ actual, expected });
}

// extension on origin 2
{
  const actual = resolveImport({
    specifier: "./",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expected = "http://example.com/";
  assert({ actual, expected });
}

// extension on origin 3
{
  const actual = resolveImport({
    specifier: ".",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expected = "http://example.com/";
  assert({ actual, expected });
}

// js extension preserved if default extension is ts
{
  const actual = resolveImport({
    specifier: "logic.v2.min.js",
    importer: "http://example.com",
    defaultExtension: ".ts",
  });
  const expected = "http://example.com/logic.v2.min.js";
  assert({ actual, expected });
}

// html extension preserved when efault extension is js
{
  const actual = resolveImport({
    specifier: "/site/page.html",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expected = "http://example.com/site/page.html";
  assert({ actual, expected });
}

// js extension added if no extension
{
  const actual = resolveImport({
    specifier: "file",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expected = "http://example.com/file.js";
  assert({ actual, expected });
}

// js extension not added if extension is .
{
  const actual = resolveImport({
    specifier: "file.",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expected = "http://example.com/file.";
  assert({ actual, expected });
}

// extension inherits but importer has no extension
{
  const actual = resolveImport({
    specifier: "file",
    importer: "http://example.com",
  });
  const expected = "http://example.com/file";
  assert({ actual, expected });
}

// inherit importer extension
{
  const actual = resolveImport({
    specifier: "file",
    importer: "http://example.com/index.js",
    defaultExtension: true,
  });
  const expected = "http://example.com/file.js";
  assert({ actual, expected });
}

// inherit importer extension even if query param
{
  const actual = resolveImport({
    specifier: "file",
    importer: "http://example.com/index.ts?foo=bar",
    defaultExtension: true,
  });
  const expected = "http://example.com/file.ts";
  assert({ actual, expected });
}

// leading slash
{
  const actual = resolveImport({
    specifier: "/foo.js",
    importer: `http://example.com/folder/file.js`,
  });
  const expected = `http://example.com/foo.js`;
  assert({ actual, expected });
}
{
  const actual = resolveImport({
    specifier: "/node_modules/ask/ask.js",
    importer: `http://example.com/folder/node_modules/foo/foo.js`,
  });
  const expected = `http://example.com/node_modules/ask/ask.js`;
  assert({ actual, expected });
}
{
  const actual = resolveImport({
    specifier: "/node_modules/ask",
    importer: `http://example.com/folder/node_modules/foo/foo.js`,
    defaultExtension: false,
  });
  const expected = `http://example.com/node_modules/ask`;
  assert({ actual, expected });
}
{
  const actual = resolveImport({
    specifier: "/node_modules/bar/bar.js",
    importer: `http://example.com/folder/node_modules/foo/foo.js`,
  });
  const expected = `http://example.com/node_modules/bar/bar.js`;
  assert({ actual, expected });
}

// ./
{
  const actual = resolveImport({
    specifier: "./foo.js",
    importer: `http://example.com/folder/file.js`,
  });
  const expected = `http://example.com/folder/foo.js`;
  assert({ actual, expected });
}
{
  const actual = resolveImport({
    specifier: "./file.js",
    importer: `http://domain.com/bar.js`,
  });
  const expected = `http://domain.com/file.js`;
  assert({ actual, expected });
}
// ../
{
  const actual = resolveImport({
    specifier: "../foo.js",
    importer: `http://example.com/folder/subfolder/file.js`,
  });
  const expected = `http://example.com/folder/foo.js`;
  assert({ actual, expected });
}
{
  const actual = resolveImport({
    specifier: "../",
    importer: `http://example.com/folder/subfolder/file.js`,
  });
  const expected = `http://example.com/folder/`;
  assert({ actual, expected });
}
{
  const actual = resolveImport({
    specifier: "../../../foo.js",
    importer: "file:///Users/file.js",
  });
  const expected = `file:///foo.js`;
  assert({ actual, expected });
}
{
  const actual = resolveImport({
    specifier: "../file.js",
    importer: `https://domain.com/folder/bar.js`,
  });
  const expected = `https://domain.com/file.js`;
  assert({ actual, expected });
}
{
  const actual = resolveImport({
    specifier: "../node_modules/bar/bar.js",
    importer: `http://example.com/folder/node_modules/foo/folder/foo.js`,
  });
  const expected = `http://example.com/folder/node_modules/foo/node_modules/bar/bar.js`;
  assert({ actual, expected });
}

// core-js test
{
  const actual = resolveImport({
    specifier: "core-js/stable/object/entries.js",
    importer: "http://example.com",
    importMap: {
      imports: {
        "core-js/": "http://example.com/node_modules/core-js/",
      },
    },
  });
  const expected = `http://example.com/node_modules/core-js/stable/object/entries.js`;
  assert({ actual, expected });
}
