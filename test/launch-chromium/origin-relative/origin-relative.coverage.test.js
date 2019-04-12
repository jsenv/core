import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { createInstrumentPlugin } from "../../../src/cover/createInstrumentPlugin.js"
import { launchAndExecute, startCompileServer, launchChromium } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `folder/file.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-instrument": [createInstrumentPlugin()],
}
const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: true,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      sourceOrigin,
      compileInto,
      compileServerOrigin,
    }),
  verbose: true,
  mirrorConsole: true,
  stopOnceExecuted: true,
  filenameRelative,
  collectNamespace: true,
  collectCoverage: true,
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
assert({ actual, expected })
