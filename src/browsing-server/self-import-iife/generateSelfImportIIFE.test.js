import { assert } from "@dmail/assert"
import { generateSelfImportIIFE } from "./generateSelfImportIIFE.js"

const { readImportMap, projectFolder, compileInto, babelConfigMap } = import.meta.require(
  "../../../jsenv.config.js",
)

const actual = await generateSelfImportIIFE({
  importMap: readImportMap(),
  projectFolder,
  babelConfigMap,
  compileInto,
  compileServerOrigin: "http://example.com",
  filenameRelative: "folder/test.js",
})
const expected = ""
assert({ actual, expected })
