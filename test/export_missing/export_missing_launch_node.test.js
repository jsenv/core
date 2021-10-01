import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  resolveDirectoryUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { launchNode } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  LAUNCH_AND_EXECUTE_TEST_PARAMS,
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
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })
const importerFileUrl = resolveUrl(mainFilename, testDirectoryUrl)

const result = await launchAndExecute({
  ...LAUNCH_AND_EXECUTE_TEST_PARAMS,
  launchAndExecuteLogLevel: "off",
  launch: (options) =>
    launchNode({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
  executeParams: {
    fileRelativeUrl,
  },
})
const stack = result.error.stack
const expected = `${importerFileUrl}:2
import { answer } from "./file.js"
         ^^^^^^
SyntaxError: The requested module './file.js' does not provide an export named 'answer'`
const actual = stack.slice(0, expected.length)
assert({ actual, expected })
