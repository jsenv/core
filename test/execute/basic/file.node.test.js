import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { execute, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.dist/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  compileDirectoryRelativeUrl,
  launch: launchNode,
  fileRelativeUrl,
})
const expected = {
  status: "completed",
}
assert({ actual, expected })
