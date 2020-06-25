import { basename } from "path"
import { assert } from "@jsenv/assert"
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

// eslint-disable-next-line import/newline-after-import
;(async () => {
  const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
  const testDirectoryname = basename(testDirectoryRelativeUrl)
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
  const filename = `${testDirectoryname}.html`
  const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
  const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })

  await Promise.all(
    [launchChromium, launchFirefox, launchWebkit].map(async (launchBrowser) => {
      const actual = await launchAndExecute({
        ...EXECUTION_TEST_PARAMS,
        launch: (options) =>
          launchBrowser({
            ...LAUNCH_TEST_PARAMS,
            ...options,
            outDirectoryRelativeUrl,
            compileServerOrigin,
            // headless: false,
          }),
        fileRelativeUrl,
        captureConsole: true,
        stopAfterExecute: true,
      })
      const expected = {
        status: "completed",
        namespace: {
          "./log.js": {
            status: "completed",
            namespace: {},
          },
        },
        consoleCalls: [
          {
            type: "log",
            text: `foo
`,
          },
          {
            type: "log",
            text: `bar
`,
          },
        ],
      }
      assert({ actual, expected })
    }),
  )
})()
