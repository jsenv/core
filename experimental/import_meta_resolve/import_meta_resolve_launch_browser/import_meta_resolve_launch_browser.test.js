import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { execute, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_BEST } from "@jsenv/core/src/internal/CONSTANTS.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryBasename = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `${testDirectoryBasename}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const compileId = COMPILE_ID_BEST
const { status, namespace, compileServerOrigin, outDirectoryRelativeUrl } =
  await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    runtime: chromiumRuntime,
    runtimeParams: {
      ...LAUNCH_TEST_PARAMS,
    },
    fileRelativeUrl,
    collectCompileServerInfo: true,
  })

const actual = {
  status,
  namespace,
}
const expected = {
  status: "completed",
  namespace: {
    [`./${testDirectoryBasename}.js`]: {
      status: "completed",
      namespace: {
        relative: `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/${testDirectoryRelativeUrl}file.js`,
        bare: `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/${testDirectoryRelativeUrl}bar.js`,
      },
    },
  },
}
assert({ actual, expected })
