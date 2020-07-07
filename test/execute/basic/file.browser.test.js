import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { execute, launchChromium, launchFirefox, launchWebkit } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.html`

await Promise.all(
  [launchChromium, launchFirefox, launchWebkit].map(async (launchBrowser) => {
    const actual = await execute({
      ...EXECUTE_TEST_PARAMS,
      launchLogLevel: "info",
      jsenvDirectoryRelativeUrl,
      launch: launchBrowser,
      fileRelativeUrl,
      stopAfterExecute: true,
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
