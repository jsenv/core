import { assert } from "@dmail/assert"
import { createCancellationSource } from "@dmail/cancellation"
import { launchChromium } from "../../index.js"
import {
  CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  CHROMIUM_LAUNCHER_TEST_PUPPETEER_PARAM,
  CHROMIUM_LAUNCHER_TEST_EXECUTION_PARAM,
  CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
} from "../chromium-launcher-test-param.js"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativePath = `${folderRelativePath}/throw-after-executed.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

const { cancel, token: cancellationToken } = createCancellationSource()

let errorCallbackParam
const actual = await launchAndExecute({
  ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  ...CHROMIUM_LAUNCHER_TEST_PUPPETEER_PARAM,
  ...CHROMIUM_LAUNCHER_TEST_EXECUTION_PARAM,
  stopOnceExecuted: false,
  cancellationToken,
  launch: (options) =>
    launchChromium({
      ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
      ...options,
      compileServerOrigin,
      compileIntoRelativePath,
    }),
  errorCallback: (param) => {
    errorCallbackParam = param
    cancel("error") // kill chromium browser to let process end
  },
  fileRelativePath,
  collectNamespace: false,
})
const expected = {
  status: "completed",
}
assert({ actual, expected })

process.on("exit", () => {
  assert({
    actual: errorCallbackParam,
    expected: {
      error: new Error(errorCallbackParam.error.message),
      timing: "after-execution",
    },
  })
})
