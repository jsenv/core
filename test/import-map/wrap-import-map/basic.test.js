import { assert } from "@dmail/assert"
import { wrapImportMap } from "../../../../../src/import-map/wrapImportMap.js"

const actual = wrapImportMap(
  {
    imports: {
      foo: "/bar/file.js",
    },
    scopes: {
      "/node_modules/@jsenv/sample-project/": {
        bar: "/src/bar.js",
        "/node_modules/@jsenv/sample-project/": "/node_modules/@jsenv/sample-project/",
        "/": "/node_modules/@jsenv/sample-project/",
      },
    },
  },
  "folder",
)
const expected = {
  imports: {
    foo: "/folder/bar/file.js", // top level foo wrapped
  },
  scopes: {
    // so that they still apply in the wrapped folder
    "/folder/node_modules/@jsenv/sample-project/": {
      // scoped bar wrapped
      bar: "/folder/src/bar.js",
      // scoped node module folder is wrapped and not duplicated
      // note how /node_modules/@jsenv/sample-project/
      // is replaced by /folder/node_modules/@jsenv/sample-project/
      "/folder/node_modules/@jsenv/sample-project/": "/folder/node_modules/@jsenv/sample-project/",
      "/": "/folder/node_modules/@jsenv/sample-project/",
    },
    "/folder/": {
      foo: "/folder/bar/file.js",
      "/folder/": "/folder/",
      "/": "/folder/",
    },
  },
}
assert({ actual, expected })
