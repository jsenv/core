import { assert } from "@dmail/assert"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { root } from "../../../root.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchChromium } from "../../launchChromium"

const file = `src/launchChromium/test/timeout/timeout.js`
const compileInto = ".dist"
const babelPluginDescription = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    root,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: ({ cancellationToken }) =>
      launchChromium({ cancellationToken, root, compileInto, remoteRoot, headless: false }),
    allocatedMs: 5000,
    stopOnceExecuted: true,
    captureConsole: true,
    file,
    verbose: true,
  })
  const expected = {
    status: "timedout",
    platformLog: `foo
`,
  }
  assert({ actual, expected })
})()
