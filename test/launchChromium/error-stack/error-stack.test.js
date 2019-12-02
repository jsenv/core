import { basename } from "path"
import { createLogger } from "@jsenv/logger"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { launchAndExecute } from "internal/executing/launchAndExecute.js"
import { launchChromium } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `${testDirectoryBasename}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`

const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

const result = await launchAndExecute({
  ...EXECUTION_TEST_PARAMS,
  // sets executeLogger to off to avoid seeing an expected error in logs
  executeLogger: createLogger({ logLevel: "off" }),
  // stopPlatformAfterExecute: false,
  fileRelativeUrl,
  launch: (options) =>
    launchChromium({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
      // headless: false,
    }),
  captureConsole: true,
  mirrorConsole: true,
})

const stack = result.error.stack
const expected = `Error: error
  at triggerError (${testDirectoryUrl}trigger-error.js:2:9)
  at Object.triggerError (${testDirectoryUrl}error-stack.js:3:1)
  at call (${jsenvCoreDirectoryUrl}src/internal/platform/s.js:358:34)
  at doExec (${jsenvCoreDirectoryUrl}src/internal/platform/s.js:354:12)
  at postOrderExec (${jsenvCoreDirectoryUrl}src/internal/platform/s.js:317:14)`
const actual = stack.slice(0, expected.length)
assert({ actual, expected })
