import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { execute, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"

import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_NODE.js"
import { removeAnnoyingLogs } from "@jsenv/core/test/removeAnnoyingLogs.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `process_disconnect.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

const { status, error, consoleCalls } = await execute({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtime: nodeRuntime,
  runtimeParams: {
    ...LAUNCH_TEST_PARAMS,
  },
  fileRelativeUrl,
  ignoreError: true,
  captureConsole: true,
})
const actual = {
  error,
  status,
  consoleCalls: removeAnnoyingLogs(consoleCalls),
}
const expected = {
  error: new Error(`runtime stopped during execution`),
  status: "errored",
  consoleCalls: [
    {
      type: "log",
      text: `here
`,
    },
  ],
}
assert({ actual, expected })
