import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/filesystem"

import { launchFirefox } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

const actual = await launchAndExecute({
  ...EXECUTION_TEST_PARAMS,
  launch: (options) =>
    launchFirefox({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      // headless: false,
    }),
  executeParams: {
    fileRelativeUrl,
  },
  stopAfterExecute: true,
})
const expected = {
  status: "completed",
  namespace: {
    [`./${testDirectoryname}.html__asset__main.js`]: {
      status: "completed",
      namespace: {
        answer: 42,
      },
    },
  },
}
assert({ actual, expected })
