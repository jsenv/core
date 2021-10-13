import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  execute,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.html`

await Promise.all(
  [
    // ensure multiline
    chromiumRuntime,
    firefoxRuntime,
    webkitRuntime,
  ].map(async (browserRuntime) => {
    const actual = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      runtime: browserRuntime,
      fileRelativeUrl,
      stopAfterExecute: true,
      mirrorConsole: false,
    })
    const expected = {
      status: "completed",
      namespace: {
        "./file.js": {
          status: "completed",
          namespace: {},
        },
      },
    }
    assert({ actual, expected })
  }),
)
