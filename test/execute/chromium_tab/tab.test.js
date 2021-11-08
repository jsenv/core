import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, chromiumTabRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `tab.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

const { status, namespace } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: chromiumTabRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
    // headless: false,
  },
  fileRelativeUrl,
  // stopAfterExecute: false,
})
const actual = {
  status,
  namespace,
}
const expected = {
  status: "completed",
  namespace: {
    "./tab.js": {
      status: "completed",
      namespace: {
        default: 42,
      },
    },
  },
}
assert({ actual, expected })
