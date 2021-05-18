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
      nodeTiming: actual.nodeTiming,
      timeOrigin: actual.timeOrigin,
      eventLoopUtilization: actual.eventLoopUtilization,
      measures: {}, // this should not be empty !!
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
