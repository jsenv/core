import { ROOT_FOLDER } from "../../src/ROOT_FOLDER.js"
import { hrefToFolderJsenvRelative } from "../../src/hrefToFolderJsenvRelative.js"
import { startBrowserExplorerServer } from "../../index.js"

const projectFolder = ROOT_FOLDER
const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const compileInto = `${testFolderRelative}/.dist`

startBrowserExplorerServer({
  projectFolder,
  compileInto,
  browsableDescription: {
    [`/${testFolderRelative}/**/*.main.js`]: true,
    [`/${testFolderRelative}/**/.dist/**`]: false,
  },
  port: 3400,
  forcePort: true,
})
