import { basename } from "path"
import { createLogger } from "@jsenv/logger"
import { assert } from "@jsenv/assert"
import { launchNode, startCompileServer, launchAndExecute } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const fileBasename = `${testDirectoryBasename}.js`
const compileDirectoryUrl = resolveDirectoryUrl("./.dist/", import.meta.url)
const fileRelativeUrl = `${testDirectoryRelativePath}${fileBasename}`

const { origin: compileServerOrigin } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
})

const result = await launchAndExecute({
  ...EXECUTE_TEST_PARAMS,
  // sets executeLogger to off to avoid seeing an expected error in logs
  executeLogger: createLogger({ logLevel: "off" }),
  launch: (options) =>
    launchNode({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      compileServerOrigin,
      compileDirectoryUrl,
    }),
  fileRelativeUrl,
})

const stack = result.error.stack
const expected = `Error: error
  at triggerError (${testDirectoryUrl}trigger-error.js:2:9)
  at Object.triggerError (${testDirectoryUrl}error-stack.js:3:1)
  at call (${jsenvCoreDirectoryUrl}src/internal/compile-server/platform-service/s.js:358:34)
  at doExec (${jsenvCoreDirectoryUrl}src/internal/compile-server/platform-service/s.js:354:12)
  at postOrderExec (${jsenvCoreDirectoryUrl}src/internal/compile-server/platform-service/s.js:317:14)
  at processTicksAndRejections (internal/process/task_queues.js:`
const actual = stack.slice(0, expected.length)
assert({ actual, expected })
