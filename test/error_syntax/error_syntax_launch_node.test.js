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

const test = async ({ forceSystemJs } = {}) => {
  const result = await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    launchAndExecuteLogLevel: "off",
    runtime: nodeRuntime,
    runtimeParams: {
      ...LAUNCH_TEST_PARAMS,
      forceSystemJs,
    },
    fileRelativeUrl,
    collectCompileServerInfo: true,
    ignoreError: true,
  })
  return result
}

// with node
{
  const result = await test()
  const actual = {
    error: result.error,
  }
  const expected = {
    error: new SyntaxError(`Unexpected end of input`),
  }
  assert({ actual, expected })
}

// with systemjs
{
  const { status, error, outDirectoryRelativeUrl } = await test({
    forceSystemJs: true,
  })
  const compiledFileUrl = `${jsenvCoreDirectoryUrl}${outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`

  const actual = {
    status,
    error,
  }
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
      filename: error.filename,
      lineno: error.lineno,
      columnno: error.columnno,
    },
  )
  const expected = {
    status: "errored",
    error: expectedError,
  }
  assert({ actual, expected })
}
