import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { assignNonEnumerableProperties } from "../assignNonEnumerableProperties.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/not-found.js`
const compileId = "otherwise"

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileIntoRelativePath,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchNode({
      ...options,
      compileServerOrigin,
      projectFolder,
      compileIntoRelativePath,
    }),
  fileRelativePath,
})
const expected = {
  status: "errored",
  error: assignNonEnumerableProperties(
    new Error(`module not found.
href: file://${projectFolder}${compileIntoRelativePath}/${compileId}${folderJsenvRelativePath}/foo.js
importerHref: file://${projectFolder}${compileIntoRelativePath}/${compileId}${fileRelativePath}`),
    {
      href: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${folderJsenvRelativePath}/foo.js`,
      importerHref: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
      code: "MODULE_NOT_FOUND_ERROR",
    },
  ),
}
assert({ actual, expected })
