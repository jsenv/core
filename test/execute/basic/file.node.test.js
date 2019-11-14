import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { execute, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativePath = `${testDirectoryRelativePath}.dist/`
const fileRelativePath = `${testDirectoryRelativePath}file.js`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  compileDirectoryRelativePath,
  launch: launchNode,
  fileRelativePath,
})
const expected = {
  status: "completed",
}
assert({ actual, expected })
