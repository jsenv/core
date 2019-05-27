import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"
import { createInstrumentPlugin } from "../../../src/coverage/createInstrumentPlugin.js"
import {
  CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  CHROMIUM_LAUNCHER_TEST_PARAM,
} from "../chromium-launcher-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/origin-relative.js`
const babelPluginMap = {
  "transform-instrument": [
    createInstrumentPlugin({
      predicate: ({ relativePath }) => relativePath === `${folderJsenvRelativePath}/file.js`,
    }),
  ],
}

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
  babelPluginMap,
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
  collectCoverage: true,
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
  coverageMap: {
    [`${folderJsenvRelativePath.slice(1)}/file.js`]: actual.coverageMap[
      `${folderJsenvRelativePath.slice(1)}/file.js`
    ],
  },
}
assert({
  actual,
  expected,
})
