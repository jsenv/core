import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../projectFolder.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const testFolder = `${projectFolder}/src/launchChromium/test/shared-node-module`
const filenameRelative = `shared-node-module.js`
const compileInto = ".dist"
const babelConfigMap = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelConfigMap,
  })

  const actual = await launchAndExecute({
    launch: () =>
      launchChromium({ compileInto, sourceOrigin, compileServerOrigin, headless: false }),
    stopOnceExecuted: true,
    mirrorConsole: true,
    collectNamespace: true,
    collectCoverage: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "completed",
    namespace: { foo: "foo" },
    coverageMap: {
      "node_modules/foo/foo.js": actual.coverageMap["node_modules/foo/foo.js"],
      "node_modules/use-shared-foo/use-shared-foo.js":
        actual.coverageMap["node_modules/use-shared-foo/use-shared-foo.js"],
      "shared-node-module.js": actual.coverageMap["shared-node-module.js"],
    },
  }
  assert({
    actual,
    expected,
  })

  // const absoluteCoverageMap = coverageMapToAbsolute(actual.coverageMap, localRoot)
  // coverageMapLog(absoluteCoverageMap)
  // coverageMapHTML(absoluteCoverageMap)
})()
