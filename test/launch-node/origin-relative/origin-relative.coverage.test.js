import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { createInstrumentPlugin } from "../../../src/cover/createInstrumentPlugin.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `folder/file.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-instrument": [createInstrumentPlugin()],
}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  collectNamespace: true,
  collectCoverage: true,
  filenameRelative,
  verbose: false,
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
  coverageMap: {
    "origin-file.js": actual.coverageMap["origin-file.js"],
    "folder/file.js": actual.coverageMap["folder/file.js"],
  },
}
assert({
  actual,
  expected,
})
