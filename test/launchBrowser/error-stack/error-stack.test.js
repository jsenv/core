import { basename } from "path"
import { createLogger } from "@jsenv/logger"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "../../../src/internal/executing/launchAndExecute.js"
import { launchChromium, launchFirefox, launchWebkit } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `${testDirectoryBasename}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

// chromium
// {
//   const result = await launchAndExecute({
//     ...EXECUTION_TEST_PARAMS,
//     // sets executeLogger to off to avoid seeing an expected error in logs
//     executeLogger: createLogger({ logLevel: "off" }),
//     // stopPlatformAfterExecute: false,
//     fileRelativeUrl,
//     launch: (options) =>
//       launchChromium({
//         ...LAUNCH_TEST_PARAMS,
//         ...options,
//         outDirectoryRelativeUrl,
//         compileServerOrigin,
//         // headless: false,
//       }),
//     captureConsole: true,
//     mirrorConsole: true,
//   })

//   const stack = result.error.stack
//   const expected = `Error: error
//   at triggerError (${testDirectoryUrl}trigger-error.js:2:9)
//   at Object.triggerError (${testDirectoryUrl}error-stack.js:3:1)`
//   const actual = stack.slice(0, expected.length)
//   assert({ actual, expected })
// }
// // firefox
// {
//   const result = await launchAndExecute({
//     ...EXECUTION_TEST_PARAMS,
//     // sets executeLogger to off to avoid seeing an expected error in logs
//     executeLogger: createLogger({ logLevel: "off" }),
//     // stopPlatformAfterExecute: false,
//     fileRelativeUrl,
//     launch: (options) =>
//       launchFirefox({
//         ...LAUNCH_TEST_PARAMS,
//         ...options,
//         outDirectoryRelativeUrl,
//         compileServerOrigin,
//         // headless: false,
//       }),
//     captureConsole: true,
//     mirrorConsole: true,
//   })

//   const stack = result.error.stack
//   const expected = `Error: error`
//   const actual = stack.slice(0, expected.length)
//   assert({ actual, expected })
// }
// webkit
{
  const result = await launchAndExecute({
    ...EXECUTION_TEST_PARAMS,
    // sets executeLogger to off to avoid seeing an expected error in logs
    executeLogger: createLogger({ logLevel: "off" }),
    stopPlatformAfterExecute: false,
    fileRelativeUrl,
    launch: (options) =>
      launchWebkit({
        ...LAUNCH_TEST_PARAMS,
        ...options,
        outDirectoryRelativeUrl,
        compileServerOrigin,
        headless: false,
      }),
    captureConsole: true,
    mirrorConsole: true,
  })

  // const stack = result.error.stack
  // const expected = `Error: error`
  // const actual = stack.slice(0, expected.length)
  // assert({ actual, expected })
}
