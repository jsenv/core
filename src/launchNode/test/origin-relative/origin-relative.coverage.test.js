import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { createInstrumentPlugin } from "../../../cover/createInstrumentPlugin.js"
import { launchNode } from "../../launchNode.js"

const testFolder = `${projectFolder}/src/launchNode/test/origin-relative`
const filenameRelative = `folder/file.js`
const compileInto = ".dist"
const babelPluginDescription = {
  "transform-instrument": [createInstrumentPlugin()],
}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
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
