import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `timeout-launch-browser.html`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`

const { status, consoleCalls } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: chromiumRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  allocatedMs: 10000,
  captureConsole: true,
})
const actual = {
  status,
  consoleCalls,
}
const expected = {
  status: "timedout",
  consoleCalls:
    // not reliable on windows and mac for some reason
    process.platform === "win32" || process.platform === "darwin"
      ? actual.consoleCalls
      : [
          {
            type: "log",
            text: `foo
`,
          },
        ],
}
assert({ actual, expected })
