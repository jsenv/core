import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { chromiumTabRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })

const actual = await launchAndExecute({
  ...EXECUTION_TEST_PARAMS,
  runtime: chromiumTabRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
    outDirectoryRelativeUrl,
    compileServerOrigin,
    // headless: false,
  },
  executeParams: {
    fileRelativeUrl,
  },
  // stopAfterExecute: false,
})
const expected = {
  status: "completed",
  namespace: {
    "./tab.js": {
      status: "completed",
      namespace: {
        default: 42,
      },
    },
  },
}
assert({ actual, expected })
