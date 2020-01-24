import { basename } from "path"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "../../../src/internal/executing/launchAndExecute.js"
import { launchChromium } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const filename = `${testDirectoryBasename}.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const actual = await launchAndExecute({
  ...EXECUTION_TEST_PARAMS,
  executeLogger: createLogger({ logLevel: "off" }),
  fileRelativeUrl,
  launch: (options) =>
    launchChromium({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
  captureConsole: true,
})
const expected = {
  status: "errored",
  error: new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"),
  consoleCalls: actual.consoleCalls,
}
assert({ actual, expected })

{
  const actual = actual.consoleCalls.some(({ text }) =>
    text.includes("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"),
  )
  const expected = false
  assert({ actual, expected })
}
