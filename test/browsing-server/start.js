import { ROOT_FOLDER } from "../../src/ROOT_FOLDER.js"
import { hrefToFolderJsenvRelative } from "../../src/hrefToFolderJsenvRelative.js"
import { startBrowsingServer } from "../../index.js"

const projectFolder = ROOT_FOLDER
const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const serverCompileInto = `${testFolderRelative}/.dist`
const clientCompileInto = ".dist"

startBrowsingServer({
  projectFolder,
  serverCompileInto,
  clientCompileInto,
  browsableDescription: {
    [`/${testFolderRelative}/**/*.main.js`]: true,
    [`/${testFolderRelative}/**/.dist/**`]: false,
  },
  port: 3400,
  forcePort: true,
})
