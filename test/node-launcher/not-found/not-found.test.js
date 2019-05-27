import { assert } from "@dmail/assert"
import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { assignNonEnumerableProperties } from "../assignNonEnumerableProperties.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/not-found.js`
const compileId = "otherwise"

const { origin: compileServerOrigin } = await startCompileServer({
  projectPath,
  compileIntoRelativePath,
  logLevel: "off",
  cleanCompileInto: true,
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
})
const projectPathname = operatingSystemPathToPathname(projectPath)
const expected = {
  status: "errored",
  error: assignNonEnumerableProperties(
    new Error(`module not found.
href: file://${projectPathname}${compileIntoRelativePath}/${compileId}${folderJsenvRelativePath}/foo.js
importerHref: file://${projectPathname}${compileIntoRelativePath}/${compileId}${fileRelativePath}`),
    {
      href: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${folderJsenvRelativePath}/foo.js`,
      importerHref: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
      code: "MODULE_NOT_FOUND_ERROR",
    },
  ),
}
assert({ actual, expected })
