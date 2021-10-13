import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToBasename,
  readFileSystemNodeStat,
  removeFileSystemNode,
} from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const executeParams = {
  ...EXECUTE_TEST_PARAMS,
  launchLogLevel: "info",
  jsenvDirectoryRelativeUrl,
  runtime: nodeRuntime,
  fileRelativeUrl,
}
const jsenvDirectoryUrl = resolveUrl(".jsenv/", testDirectoryUrl)

const testDirectoryPresence = async (source) => {
  const stats = await readFileSystemNodeStat(source, { nullIfNotFound: true })
  return Boolean(stats && stats.isDirectory())
}
await removeFileSystemNode(jsenvDirectoryUrl, {
  recursive: true,
  allowUseless: true,
})

// measure and collect perf
{
  const executeResult = await execute({
    ...executeParams,
    measurePerformance: true,
    collectPerformance: true,
    compileServerCanWriteOnFilesystem: false,
  })
  const actual = {
    performance: executeResult.performance,
    jsenvDirectoryPresence: await testDirectoryPresence(jsenvDirectoryUrl),
  }
  const expected = {
    performance: {
      nodeTiming: actual.performance.nodeTiming,
      timeOrigin: actual.performance.timeOrigin,
      eventLoopUtilization: actual.performance.eventLoopUtilization,
      measures: {
        "jsenv_file_import": assert.any(Number),
        "a to b": assert.any(Number),
      },
    },
    jsenvDirectoryPresence: false,
  }
  assert({ actual, expected })
}

// default
{
  const executeResult = await execute({
    ...executeParams,
  })
  const actual = {
    performance: executeResult.performance,
    jsenvDirectoryPresence: await testDirectoryPresence(jsenvDirectoryUrl),
  }
  const expected = {
    performance: undefined,
    jsenvDirectoryPresence: true,
  }
  assert({ actual, expected })
  await removeFileSystemNode(jsenvDirectoryUrl, { recursive: true })
}
