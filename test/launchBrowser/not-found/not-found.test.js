import { basename } from "path"
import { createLogger } from "@jsenv/logger"
import { assert } from "@jsenv/assert"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "../../../src/internal/executing/launchAndExecute.js"
import { launchChromium, launchFirefox, launchWebkit } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const compileId = "otherwise"
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileGroupCount: 1, // force otherwise compileId
})

await Promise.all(
  [launchChromium, launchFirefox, launchWebkit].map(async (launchBrowser) => {
    const result = await launchAndExecute({
      ...EXECUTION_TEST_PARAMS,
      executeLogger: createLogger({ logLevel: "off" }),
      fileRelativeUrl,
      launch: (options) =>
        launchBrowser({
          ...LAUNCH_TEST_PARAMS,
          ...options,
          outDirectoryRelativeUrl,
          compileServerOrigin,
        }),
    })
    const actual = {
      status: result.status,
      errorMessage: result.error.message,
    }
    const expected = {
      status: "errored",
      errorMessage: `imported module not found.
--- url ---
${resolveUrl(
  `${outDirectoryRelativeUrl}${compileId}/${testDirectoryRelativeUrl}foo.js`,
  jsenvCoreDirectoryUrl,
)}
--- importer url ---
${resolveUrl(`${outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`, jsenvCoreDirectoryUrl)}`,
    }
    assert({ actual, expected })
  }),
)
