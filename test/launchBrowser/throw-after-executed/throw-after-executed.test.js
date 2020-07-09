import { basename } from "path"
import { createCancellationSource } from "@jsenv/cancellation"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "../../../src/internal/executing/launchAndExecute.js"
import { launchChromium } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `${testDirectoryBasename}.html`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { cancel, token: cancellationToken } = createCancellationSource()

let errorCallbackArg
const actual = await launchAndExecute({
  ...EXECUTION_TEST_PARAMS,
  cancellationToken,
  fileRelativeUrl,
  launch: (options) =>
    launchChromium({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
  stopAfterExecute: false,
  runtimeErrorCallback: (argValue) => {
    errorCallbackArg = argValue
    cancel("error") // kill chromium browser to let process end
  },
})

const expected = {
  status: "completed",
  namespace: {
    "./throw-after-executed.js": {
      status: "completed",
      namespace: {},
    },
  },
}
assert({ actual, expected })

process.on("exit", () => {
  const actual = errorCallbackArg
  const expected = {
    error: new Error(errorCallbackArg.error.message),
    timing: "after-execution",
  }
  assert({ actual, expected })
})
