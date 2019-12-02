import { basename } from "path"
import { createLogger } from "@jsenv/logger"
import { assert } from "@jsenv/assert"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { launchAndExecute } from "internal/executing/launchAndExecute.js"
import { launchNode } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const compileId = "best"
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

const actual = await launchAndExecute({
  ...EXECUTE_TEST_PARAMS,
  executeLogger: createLogger({ logLevel: "off" }),
  fileRelativeUrl,
  launch: (options) =>
    launchNode({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
})
const expected = {
  status: "errored",
  error: new Error(`imported module not found.
--- url ---
${resolveUrl(
  `${outDirectoryRelativeUrl}${compileId}/${testDirectoryRelativeUrl}foo.js`,
  jsenvCoreDirectoryUrl,
)}
--- importer url ---
${resolveUrl(`${outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`, jsenvCoreDirectoryUrl)}`),
}
assert({ actual, expected })
