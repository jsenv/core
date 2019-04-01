import { assert } from "/node_modules/@dmail/assert/index.js"
import { remapResolvedImport } from "/node_modules/@jsenv/module-resolution/index.js"
import { wrapImportMap } from "../../wrapImportMap.js"

const importMap = {
  imports: {
    foo: "/bar/file.js",
  },
}
const wrappedImportMap = wrapImportMap(importMap, "folder")
const actual = remapResolvedImport({
  importMap: wrappedImportMap,
  importerHref: `http://example.com/folder/file.js`,
  resolvedImport: `http://example.com/foo`,
})
const expected = `http://example.com/folder/bar/file.js`
assert({ actual, expected })
