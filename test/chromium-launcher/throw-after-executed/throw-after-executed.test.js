import { assert } from "@dmail/assert"
import { createCancellationSource } from "@dmail/cancellation"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"
import {
  CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  CHROMIUM_LAUNCHER_TEST_PARAM,
} from "../chromium-launcher-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/throw-after-executed.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

const { cancel, token: cancellationToken } = createCancellationSource()

let errorCallbackParam
const actual = await launchAndExecute({
  ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  cancellationToken,
  launch: (options) =>
    launchChromium({
      ...CHROMIUM_LAUNCHER_TEST_PARAM,
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
