import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { assignNonEnumerableProperties } from "../assignNonEnumerableProperties.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const compileInto = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/not-found.js`
const compileId = "otherwise"

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, projectFolder, compileServerOrigin, compileInto }),
  fileRelativePath,
})
const expected = {
  status: "errored",
  error: assignNonEnumerableProperties(
    new Error(`module not found.
href: file://${projectFolder}/${compileInto}/${compileId}/${folderJsenvRelativePath}/foo.js
importerHref: file://${projectFolder}/${compileInto}/${compileId}/${folderJsenvRelativePath}/not-found.js`),
    {
      href: `${compileServerOrigin}/${compileInto}/${compileId}/${folderJsenvRelativePath}/foo.js`,
      importerHref: `${compileServerOrigin}/${compileInto}/${compileId}/${folderJsenvRelativePath}/not-found.js`,
      code: "MODULE_NOT_FOUND_ERROR",
    },
  ),
}
assert({ actual, expected })
