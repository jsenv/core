import { assert } from "@dmail/assert"
import { pathnameToFileHref } from "@jsenv/module-resolution"
import { projectFolder } from "../../../projectFolder.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const filenameRelative = `src/launchChromium/test/log/log.js`
const compileInto = "build"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = pathnameToFileHref(projectFolder)

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: (options) =>
      launchChromium({
        ...options,
        compileInto,
        sourceOrigin,
        compileServerOrigin,
        headless: false,
      }),
    stopOnceExecuted: true,
    mirrorConsole: true,
    captureConsole: true,
    filenameRelative,
    verbose: true,
    platformTypeForLog: "chromium browser",
  })
  const expected = {
    status: "completed",
    platformLog: `foo
bar
`,
  }
  assert({ actual, expected })
})()
