import { assert } from "@jsenv/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/internal/urlUtils.js"
import { execute } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(
  testDirectoryUrl,
  EXECUTE_TEST_PARAMS.projectDirectoryUrl,
)
const compileDirectoryRelativePath = `${testDirectoryRelativePath}.dist/`
const fileRelativePath = `${compileDirectoryRelativePath}file.js`

const actual = await execute({
  ...EXECUTE_TEST_PARAMS,
  compileDirectoryRelativePath,
  launch: launchChromium,
  fileRelativePath,
  stopOnceExecuted: true,
})
const expected = {
  status: "completed",
}
assert({ actual, expected })
