import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../projectFolder.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const testFolder = `${projectFolder}/src/launchChromium/test/origin-relative`
const filenameRelative = `folder/file.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: () =>
      launchChromium({ compileInto, sourceOrigin, compileServerOrigin, headless: false }),
    verbose: true,
    stopOnceExecuted: true,
    mirrorConsole: true,
    filenameRelative,
    collectNamespace: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
  }
  assert({ actual, expected })
})()
