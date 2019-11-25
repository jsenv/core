import { assert } from "@dmail/assert"
import { launchChromium, launchChromiumProjectPathname } from "../../index.js"
import {
  CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  CHROMIUM_LAUNCHER_TEST_PUPPETEER_PARAM,
  CHROMIUM_LAUNCHER_TEST_EXECUTION_PARAM,
  CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
} from "../chromium-launcher-test-param.js"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativePath = `${folderRelativePath}/throw.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

const result = await launchAndExecute({
  ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  ...CHROMIUM_LAUNCHER_TEST_PUPPETEER_PARAM,
  ...CHROMIUM_LAUNCHER_TEST_EXECUTION_PARAM,
  launch: (options) =>
    launchChromium({
      ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
      ...options,
      compileServerOrigin,
      compileIntoRelativePath,
    }),
  fileRelativePath,
})

const stack = result.error.stack
const expected = `Error: error
  at triggerError (file://${launchChromiumProjectPathname}${folderRelativePath}/trigger-error.js:2:9)
  at Object.triggerError (file://${launchChromiumProjectPathname}${folderRelativePath}/throw.js:3:1)
  at call (file://${launchChromiumProjectPathname}/node_modules/@jsenv/compile-server/src/startCompileServer/system/s-fork.js:347:34)
  at doExec (file://${launchChromiumProjectPathname}/node_modules/@jsenv/compile-server/src/startCompileServer/system/s-fork.js:343:12)
  at postOrderExec (file://${launchChromiumProjectPathname}/node_modules/@jsenv/compile-server/src/startCompileServer/system/s-fork.js:305:14)`
const actual = stack.slice(0, expected.length)
assert({ actual, expected })
