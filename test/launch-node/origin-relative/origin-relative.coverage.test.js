import { assert } from "/node_modules/@dmail/assert/index.js"
import { createInstrumentPlugin } from "../../../src/cover/createInstrumentPlugin.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/launch-node/test/origin-relative`
const filenameRelative = `folder/file.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-instrument": [createInstrumentPlugin()],
}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelConfigMap,
  })

  const actual = await launchAndExecute({
    launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    collectNamespace: true,
    collectCoverage: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
    coverageMap: {
      "folder/file.js": actual.coverageMap["folder/file.js"],
      "origin-file.js": actual.coverageMap["origin-file.js"],
    },
  }
  assert({
    actual,
    expected,
  })
})()
