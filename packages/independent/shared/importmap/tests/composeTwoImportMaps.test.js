import { assert } from "@jsenv/assert";
import { composeTwoImportMaps, sortImportMap } from "@jsenv/importmap";

{
  const actual = sortImportMap(
    composeTwoImportMaps(
      {
        imports: {
          foo: "foo-remap",
          a: "a-remap",
        },
      },
      {
        imports: {
          foo: "foo-remap-2",
          b: "b-remap",
        },
      },
    ),
  );
  const expected = {
    imports: {
      foo: "foo-remap-2",
      a: "a-remap",
      b: "b-remap",
    },
  };
  assert({ actual, expected });
}

{
  const actual = sortImportMap(
    composeTwoImportMaps(
      {
        imports: {
          foo: "foo-remap",
          a: "a-remap",
        },
        scopes: {
          foo: {
            foo: "foo-scoped-remap",
            a: "a-scoped-remap",
          },
          a: {},
        },
      },
      {
        imports: {
          foo: "foo-remap-2",
          b: "b-remap-2",
        },
        scopes: {
          foo: {
            foo: "foo-scoped-remap-2",
            b: "b-scoped-remap-2",
          },
          b: {},
        },
      },
    ),
  );
  const expected = {
    imports: {
      foo: "foo-remap-2",
      a: "a-remap",
      b: "b-remap-2",
    },
    scopes: {
      "a-remap": {},
      "foo": {
        foo: "foo-scoped-remap-2",
        a: "a-scoped-remap",
        b: "b-scoped-remap-2",
      },
      "b": {},
    },
  };
  assert({ actual, expected });
}

// resolve first top level import with second top level import
{
  const actual = sortImportMap(
    composeTwoImportMaps(
      {
        imports: {
          foo: "a",
        },
      },
      {
        imports: {
          a: "./b.js",
        },
      },
    ),
  );
  const expected = {
    imports: {
      foo: "./b.js",
      a: "./b.js",
    },
  };
  assert({ actual, expected });
}

// resolve in scopes too
{
  const actual = sortImportMap(
    composeTwoImportMaps(
      {
        scopes: {
          directory: {
            foo: "./a.js",
          },
        },
      },
      {
        scopes: {
          directory: {
            "./a.js": "./b.js",
          },
        },
      },
    ),
  );
  const expected = {
    scopes: {
      directory: {
        "./a.js": "./b.js",
        "foo": "./b.js",
      },
    },
  };
  assert({ actual, expected });
}
