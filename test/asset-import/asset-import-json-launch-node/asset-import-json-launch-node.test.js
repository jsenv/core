import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

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
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativePath)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

const test = async ({ jsonModulesFlag = false } = {}) => {
  const result = await launchAndExecute({
    ...LAUNCH_AND_EXECUTE_TEST_PARAMS,
    launch: (options) =>
      launchNode({
        ...LAUNCH_TEST_PARAMS,
        ...options,
        commandLineOptions: [
          jsonModulesFlag ? "--experimental-json-modules" : "--experimental-json-modules=unset",
        ],
        outDirectoryRelativeUrl,
        compileServerOrigin,
      }),
    executeParams: {
      fileRelativeUrl,
    },
  })
  return result
}

// without json module flag
{
  const result = await test()
  const actual = result.error.code
  const expected = "ERR_UNKNOWN_FILE_EXTENSION"
  assert({ actual, expected })
}

// with json module flag
{
  const actual = await test({ jsonModulesFlag: true })
  const expected = {
    status: "completed",
    namespace: {
      default: {
        foo: true,
      },
    },
  }
  assert({ actual, expected })
}
