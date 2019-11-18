import { assert } from "@jsenv/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { resolveDirectoryUrl, urlToRelativeUrl } from "src/internal/urlUtils.js"
import { execute } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  EXECUTE_TEST_PARAMS.projectDirectoryUrl,
)
const compileDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.dist/`
const fileRelativeUrl = `${compileDirectoryRelativeUrl}file.js`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  compileDirectoryRelativeUrl,
  launch: launchChromium,
  fileRelativeUrl,
  stopOnceExecuted: true,
})
const expected = {
  status: "completed",
}
assert({ actual, expected })
