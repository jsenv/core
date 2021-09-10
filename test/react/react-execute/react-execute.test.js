import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, launchChromium, convertCommonJsWithRollup } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}react-execute.html`
const convertMap = {
  "./node_modules/react/index.js": (options) =>
    convertCommonJsWithRollup({ ...options, processEnvNodeEnv: "production" }),
}

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  convertMap,
  launch: launchChromium,
  stopAfterExecute: true,
  fileRelativeUrl,
})
const expected = {
  status: "completed",
  namespace: {
    "./react-execute.js": {
      status: "completed",
      namespace: {
        default: "object",
      },
    },
  },
}
assert({ actual, expected })
