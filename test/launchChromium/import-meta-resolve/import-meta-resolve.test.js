import { assert } from "@dmail/assert"
import { launchChromium } from "../../index.js"
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
const fileRelativePath = `${folderRelativePath}/import-meta-resolve.js`
const compileId = "otherwise"

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
  importMapRelativePath: `${folderRelativePath}/importMap.json`,
  compileGroupCount: 1, // ensure compileId always otherwise
})

const actual = await launchAndExecute({
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
const expected = {
  status: "completed",
  namespace: {
    basic: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${folderRelativePath}/file.js`,
    remapped: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}/bar.js`,
  },
}
assert({ actual, expected })
