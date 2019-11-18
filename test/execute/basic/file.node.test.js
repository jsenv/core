import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { execute, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativeUrl = `${testDirectoryRelativePath}.dist/`
const fileRelativeUrl = `${testDirectoryRelativePath}file.js`

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
