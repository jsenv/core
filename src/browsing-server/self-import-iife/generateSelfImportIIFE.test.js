import { assert } from "@dmail/assert"
import { generateSelfImportIIFE } from "./generateSelfImportIIFE.js"

const { importMap, projectFolder, compileInto, babelConfigMap } = import.meta.require(
  "../../../jsenv.config.js",
)

const actual = await generateSelfImportIIFE({
  importMap,
  projectFolder,
  babelConfigMap,
  compileInto,
  compileServerOrigin: "http://example.com",
  filenameRelative: "folder/test.js",
})
debugger
const expected = ""
assert({ actual, expected })
