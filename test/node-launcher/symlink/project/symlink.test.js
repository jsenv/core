import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../../index.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/symlink.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileIntoRelativePath,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchNode({ ...options, compileServerOrigin, projectFolder, compileIntoRelativePath }),
  fileRelativePath,
  collectNamespace: true,
})
const expected = {
  status: "completed",
  namespace: {
    default: "foo",
  },
}
assert({ actual, expected })
