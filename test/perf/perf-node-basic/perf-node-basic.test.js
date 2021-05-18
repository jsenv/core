import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

import { execute, launchNode } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const executeParams = {
  ...EXECUTE_TEST_PARAMS,
  launchLogLevel: "info",
  jsenvDirectoryRelativeUrl,
  launch: launchNode,
  fileRelativeUrl,
}

// measure and collect perf
{
  const actual = await execute({
    ...executeParams,
    measurePerformance: true,
    collectPerformance: true,
  })
  const expected = {
    status: "completed",
    namespace: {},
    performance: {
      nodeTiming: actual.performance.nodeTiming,
      timeOrigin: actual.performance.timeOrigin,
      eventLoopUtilization: actual.performance.eventLoopUtilization,
      measures: {
        "jsenv_file_import": assert.any(Number),
        "a to b": assert.any(Number),
      },
    },
  }
  assert({ actual, expected })
}

// default
{
  const actual = await execute({
    ...executeParams,
  })
  const expected = {
    status: "completed",
    namespace: {},
  }
  assert({ actual, expected })
}
