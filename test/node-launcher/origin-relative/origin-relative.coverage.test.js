import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"
import { createInstrumentPlugin } from "../../../src/coverage/createInstrumentPlugin.js"

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
  ...NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
  babelPluginMap,
})

const actual = await launchAndExecute({
  ...NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  launch: (options) =>
    launchNode({
      ...NODE_LAUNCHER_TEST_PARAM,
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
