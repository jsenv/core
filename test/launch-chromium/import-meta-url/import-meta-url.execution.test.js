import { assert } from "/node_modules/@dmail/assert/index.js"
import { launchAndExecute, startCompileServer, launchChromium } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/launch-chromium/import-meta-url`
const filenameRelative = `import-meta-url.js`
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
    laynch: (options) =>
      launchChromium({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
    stopOnceExecuted: true,
    verbose: true,
    mirrorConsole: true,
    collectNamespace: true,
    filenameRelative,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: `${compileServerOrigin}/${compileInto}/best/${filenameRelative}`,
    },
  }
  assert({ actual, expected })
})()
