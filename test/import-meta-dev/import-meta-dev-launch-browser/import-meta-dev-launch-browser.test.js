import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"
import { execute, launchChromium } from "@jsenv/core"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.html`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  importMetaDev: true,
  jsenvDirectoryRelativeUrl,
  launch: launchChromium,
  fileRelativeUrl,
  stopAfterExecute: true,
})
const expected = {
  status: "completed",
  namespace: {
    [`./${testDirectoryname}.js`]: {
      status: "completed",
      namespace: {
        value: {
          whatever: 42,
        },
      },
    },
  },
}
assert({ actual, expected })
