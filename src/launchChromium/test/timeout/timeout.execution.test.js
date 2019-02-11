import { assert } from "@dmail/assert"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { localRoot } from "../../../localRoot.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchChromium } from "../../launchChromium"

const file = `src/launchChromium/test/timeout/timeout.js`
const compileInto = "build"
const pluginMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute(
    ({ cancellationToken }) =>
      launchChromium({ cancellationToken, localRoot, remoteRoot, compileInto, headless: false }),
    file,
    {
      platformTypeForLog: "chromium browser",
      stopOnceExecuted: true,
      verbose: true,
      allocatedMs: 5000,
      captureConsole: true,
    },
  )
  const expected = {
    status: "timedout",
    platformLog: `foo
`,
  }
  assert({ actual, expected })
})()
