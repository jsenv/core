import { assert } from "@dmail/assert"
import { remapResolvedImport } from "@jsenv/module-resolution"
import { wrapImportMap } from "../../../src/import-map/wrapImportMap.js"

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
