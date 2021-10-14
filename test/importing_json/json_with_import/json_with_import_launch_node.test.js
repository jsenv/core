import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `main.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`

const test = async ({ jsonModulesFlag = false } = {}) => {
  const result = await execute({
    ...EXECUTE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    runtime: nodeRuntime,
    runtimeParams: {
      ...LAUNCH_TEST_PARAMS,
      commandLineOptions: [
        jsonModulesFlag
          ? "--experimental-json-modules"
          : "--experimental-json-modules=unset",
      ],
    },
    fileRelativeUrl,
    ignoreError: true,
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
        whatever: "It's cool",
        [`w"ow`]: 42,
      },
    },
  }
  assert({ actual, expected })
}
