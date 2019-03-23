import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/import-meta-url/import-meta-url.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    root,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    laynch: (options) => launchChromium({ ...options, root, compileInto, remoteRoot }),
    stopOnceExecuted: true,
    verbose: true,
    mirrorConsole: true,
    collectNamespace: true,
    file,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: `${remoteRoot}/${compileInto}/best/${file}`,
    },
  }
  assert({ actual, expected })
})()
