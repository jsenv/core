import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `error_syntax.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const filePath = urlToFileSystemPath(fileUrl)
const compileId = "best"
const compiledFileUrl = `${jsenvCoreDirectoryUrl}.jsenv/out-dev/${compileId}/${fileRelativeUrl}`

const test = async ({ canUseNativeModuleSystem } = {}) => {
  const result = await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    launchAndExecuteLogLevel: "off",
    runtime: nodeRuntime,
    runtimeParams: {
      ...LAUNCH_TEST_PARAMS,
      canUseNativeModuleSystem,
    },
    fileRelativeUrl,
    ignoreError: true,
  })
  return result
}

// with node
{
  const result = await test()
  const actual = result
  const expected = actual
  assert({ actual, expected })
}

// with systemjs
{
  const actual = await test({
    canUseNativeModuleSystem: false,
  })
  const parsingError = {
    message: `${filePath}: Unexpected token (1:11)

> 1 | const a = (
    |            ^`,
    messageHTML: assert.any(String),
    filename: filePath,
    lineNumber: 1,
    columnNumber: 11,
  }
  const expectedError = Object.assign(
    new Error(`JavaScript module file cannot be parsed
--- parsing error message ---
${filePath}: Unexpected token (1:11)

> 1 | const a = (
    |            ^
--- file ---
${fileRelativeUrl}
--- file url ---
${compiledFileUrl}`),
    {
      parsingError,
      filename: actual.error.filename,
      lineno: actual.error.lineno,
      columnno: actual.error.columnno,
    },
  )
  const expected = {
    status: "errored",
    error: expectedError,
  }
  assert({ actual, expected })
}
