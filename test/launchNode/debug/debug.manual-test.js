import { basename } from "path"
import { assert } from "@jsenv/assert"
import { launchNode, startCompileServer, launchAndExecute } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativeUrl } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const fileBasename = `${testDirectoryBasename}.js`
const compileDirectoryUrl = resolveDirectoryUrl("./.dist/", import.meta.url)
const fileRelativeUrl = `${testDirectoryRelativePath}${fileBasename}`

const { origin: compileServerOrigin } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
})

const actual = await launchAndExecute({
  ...EXECUTE_TEST_PARAMS,
  launch: (options) =>
    launchNode({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      compileServerOrigin,
      compileDirectoryUrl,
    }),
  fileRelativeUrl,
  mirrorConsole: true,
  collectNamespace: false,
})
const expected = {
  status: "completed",
}
assert({ actual, expected })
