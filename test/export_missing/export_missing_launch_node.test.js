import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  resolveDirectoryUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const mainFilename = `export_missing.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const importerFileUrl = resolveUrl(mainFilename, testDirectoryUrl)

const result = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  launchAndExecuteLogLevel: "off",
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  ignoreError: true,
})
const stack = result.error.stack
const expected = `${importerFileUrl}:2
import { answer } from "./file.js"
         ^^^^^^
SyntaxError: The requested module './file.js' does not provide an export named 'answer'`
const actual = stack.slice(0, expected.length)
assert({ actual, expected })
