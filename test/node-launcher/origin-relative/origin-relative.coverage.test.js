import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { createInstrumentPlugin } from "../../../src/coverage/createInstrumentPlugin.js"

const projectPath = JSENV_PATH
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
  projectPath,
  compileIntoRelativePath,
  babelPluginMap,
  cleanCompileInto: true,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchNode({
      ...options,
      compileServerOrigin,
      projectPath,
      compileIntoRelativePath,
    }),
  fileRelativePath,
  collectNamespace: true,
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
