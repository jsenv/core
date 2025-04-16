import { assert } from "@jsenv/assert";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
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
  const expect = {
    imports: {
      foo: "foo-remap-2",
      a: "a-remap",
      b: "b-remap",
    },
  };
  assert({ actual, expect });
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
  const expect = {
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
  assert({ actual, expect });
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
  const expect = {
    imports: {
      foo: "./b.js",
      a: "./b.js",
    },
  };
  assert({ actual, expect });
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
  const expect = {
    scopes: {
      directory: {
        "./a.js": "./b.js",
        "foo": "./b.js",
      },
    },
  };
  assert({ actual, expect });
}
