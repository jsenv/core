import { basename } from "path"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
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
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryBasename}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
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
      captureConsole: true,
    })
    const actual = {
      status: result.status,
      errorMessage: result.error.message,
    }
    const expected = {
      status: "errored",
      errorMessage: "SPECIAL_STRING_UNLIKELY_TO_COLLIDE",
    }
    assert({ actual, expected })
    {
      const actual = result.consoleCalls.some(({ text }) =>
        text.includes("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"),
      )
      const expected = false
      assert({ actual, expected })
    }
  }),
)
