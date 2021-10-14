import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, firefoxRuntime } from "@jsenv/core"
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
const filename = `firefox.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: firefoxRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
    // headless: false,
  },
  fileRelativeUrl,
})
const expected = {
  status: "completed",
  namespace: {
    [`./firefox.html__asset__main.js`]: {
      status: "completed",
      namespace: {
        answer: 42,
      },
    },
  },
}
assert({ actual, expected })
