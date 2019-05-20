import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startBrowserExplorerServer } from "../../index.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`

startBrowserExplorerServer({
  projectPath,
  compileIntoRelativePath,
  browsableDescription: {
    [`${folderJsenvRelativePath}/**/*.main.js`]: true,
    [`${folderJsenvRelativePath}/**/.dist/**`]: false,
  },
  port: 3400,
  forcePort: true,
})
