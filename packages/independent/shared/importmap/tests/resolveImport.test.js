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
  const expect = `http://example.com/remapped/foo.js`;
  assert({ actual, expect });
}

// http
{
  const actual = resolveImport({
    specifier: "https://code.jquery.com/jquery-3.3.1.min.js",
    importer: import.meta.url,
  });
  const expect = "https://code.jquery.com/jquery-3.3.1.min.js";
  assert({ actual, expect });
}

// file
{
  const actual = resolveImport({
    specifier: "file:///Users/file.js",
    importer: import.meta.url,
  });
  const expect = "file:///Users/file.js";
  assert({ actual, expect });
}

// bare + importer file
{
  const actual = resolveImport({
    specifier: "foo",
    importer: `file:///C:/folder/file.js`,
    defaultExtension: false,
  });
  const expect = `file:///C:/folder/foo`;
  assert({ actual, expect });
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
  const expect = `${origin}/node_modules/foo/src/foo.js`;
  assert({ actual, expect });
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
  const expect = `${origin}/node_modules/foo/src/foo.js`;
  assert({ actual, expect });
}

// extension on origin
{
  const actual = resolveImport({
    specifier: "../",
    importer: "http://example.com/folder/file.js",
    defaultExtension: ".js",
  });
  const expect = "http://example.com/";
  assert({ actual, expect });
}

// extension on directory
{
  const actual = resolveImport({
    specifier: "../",
    importer: "https://domain.com/folder/subfolder/file.js",
    defaultExtension: ".js",
  });
  const expect = "https://domain.com/folder/";
  assert({ actual, expect });
}

// extension on origin 2
{
  const actual = resolveImport({
    specifier: "./",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expect = "http://example.com/";
  assert({ actual, expect });
}

// extension on origin 3
{
  const actual = resolveImport({
    specifier: ".",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expect = "http://example.com/";
  assert({ actual, expect });
}

// js extension preserved if default extension is ts
{
  const actual = resolveImport({
    specifier: "logic.v2.min.js",
    importer: "http://example.com",
    defaultExtension: ".ts",
  });
  const expect = "http://example.com/logic.v2.min.js";
  assert({ actual, expect });
}

// html extension preserved when efault extension is js
{
  const actual = resolveImport({
    specifier: "/site/page.html",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expect = "http://example.com/site/page.html";
  assert({ actual, expect });
}

// js extension added if no extension
{
  const actual = resolveImport({
    specifier: "file",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expect = "http://example.com/file.js";
  assert({ actual, expect });
}

// js extension not added if extension is .
{
  const actual = resolveImport({
    specifier: "file.",
    importer: "http://example.com",
    defaultExtension: ".js",
  });
  const expect = "http://example.com/file.";
  assert({ actual, expect });
}

// extension inherits but importer has no extension
{
  const actual = resolveImport({
    specifier: "file",
    importer: "http://example.com",
  });
  const expect = "http://example.com/file";
  assert({ actual, expect });
}

// inherit importer extension
{
  const actual = resolveImport({
    specifier: "file",
    importer: "http://example.com/index.js",
    defaultExtension: true,
  });
  const expect = "http://example.com/file.js";
  assert({ actual, expect });
}

// inherit importer extension even if query param
{
  const actual = resolveImport({
    specifier: "file",
    importer: "http://example.com/index.ts?foo=bar",
    defaultExtension: true,
  });
  const expect = "http://example.com/file.ts";
  assert({ actual, expect });
}

// leading slash
{
  const actual = resolveImport({
    specifier: "/foo.js",
    importer: `http://example.com/folder/file.js`,
  });
  const expect = `http://example.com/foo.js`;
  assert({ actual, expect });
}
{
  const actual = resolveImport({
    specifier: "/node_modules/ask/ask.js",
    importer: `http://example.com/folder/node_modules/foo/foo.js`,
  });
  const expect = `http://example.com/node_modules/ask/ask.js`;
  assert({ actual, expect });
}
{
  const actual = resolveImport({
    specifier: "/node_modules/ask",
    importer: `http://example.com/folder/node_modules/foo/foo.js`,
    defaultExtension: false,
  });
  const expect = `http://example.com/node_modules/ask`;
  assert({ actual, expect });
}
{
  const actual = resolveImport({
    specifier: "/node_modules/bar/bar.js",
    importer: `http://example.com/folder/node_modules/foo/foo.js`,
  });
  const expect = `http://example.com/node_modules/bar/bar.js`;
  assert({ actual, expect });
}

// ./
{
  const actual = resolveImport({
    specifier: "./foo.js",
    importer: `http://example.com/folder/file.js`,
  });
  const expect = `http://example.com/folder/foo.js`;
  assert({ actual, expect });
}
{
  const actual = resolveImport({
    specifier: "./file.js",
    importer: `http://domain.com/bar.js`,
  });
  const expect = `http://domain.com/file.js`;
  assert({ actual, expect });
}
// ../
{
  const actual = resolveImport({
    specifier: "../foo.js",
    importer: `http://example.com/folder/subfolder/file.js`,
  });
  const expect = `http://example.com/folder/foo.js`;
  assert({ actual, expect });
}
{
  const actual = resolveImport({
    specifier: "../",
    importer: `http://example.com/folder/subfolder/file.js`,
  });
  const expect = `http://example.com/folder/`;
  assert({ actual, expect });
}
{
  const actual = resolveImport({
    specifier: "../../../foo.js",
    importer: "file:///Users/file.js",
  });
  const expect = `file:///foo.js`;
  assert({ actual, expect });
}
{
  const actual = resolveImport({
    specifier: "../file.js",
    importer: `https://domain.com/folder/bar.js`,
  });
  const expect = `https://domain.com/file.js`;
  assert({ actual, expect });
}
{
  const actual = resolveImport({
    specifier: "../node_modules/bar/bar.js",
    importer: `http://example.com/folder/node_modules/foo/folder/foo.js`,
  });
  const expect = `http://example.com/folder/node_modules/foo/node_modules/bar/bar.js`;
  assert({ actual, expect });
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
  const expect = `http://example.com/node_modules/core-js/stable/object/entries.js`;
  assert({ actual, expect });
}
