import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"
import {
  CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  CHROMIUM_LAUNCHER_TEST_PARAM,
} from "../chromium-launcher-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/dynamic-import.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

const actual = await launchAndExecute({
  ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  launch: (options) =>
    launchChromium({
      ...CHROMIUM_LAUNCHER_TEST_PARAM,
      ...options,
      compileServerOrigin,
      compileIntoRelativePath,
    }),
  fileRelativePath,
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
}
assert({ actual, expected })
