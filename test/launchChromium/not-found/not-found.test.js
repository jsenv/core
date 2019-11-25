import { assert } from "@dmail/assert"
import { launchChromium, launchChromiumProjectPathname } from "../../index.js"
import {
  CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  CHROMIUM_LAUNCHER_TEST_PUPPETEER_PARAM,
  CHROMIUM_LAUNCHER_TEST_EXECUTION_PARAM,
  CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
} from "../chromium-launcher-test-param.js"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"
import { assignNonEnumerableProperties } from "../assignNonEnumerableProperties.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativePath = `${folderRelativePath}/not-found.js`
const compileId = "otherwise"

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
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
  status: "errored",
  error: assignNonEnumerableProperties(
    new Error(`imported module not found.
href: file://${launchChromiumProjectPathname}${compileIntoRelativePath}/${compileId}${folderRelativePath}/foo.js
importer href: file://${launchChromiumProjectPathname}${compileIntoRelativePath}/${compileId}${fileRelativePath}`),
    {
      code: "MODULE_NOT_FOUND_ERROR",
      href: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${folderRelativePath}/foo.js`,
      importerHref: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
    },
  ),
}
assert({ actual, expected })
