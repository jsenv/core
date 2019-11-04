import { assert } from "@dmail/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/private/urlUtils.js"
import { execute } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const { convertCommonJsWithRollup } = import.meta.require("@jsenv/commonjs-converter")

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
  collectNamespace: true,
  convertMap: {
    "./node_modules/react/index.js": (options) =>
      convertCommonJsWithRollup({ ...options, processEnvNodeEnv: "production" }),
  },
})
const expected = {
  status: "completed",
  namespace: {
    default: "object",
  },
}
assert({ actual, expected })
