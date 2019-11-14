import { exploringServerProjectPath } from "../src/exploring-server-project.js"
import { startExploringServer } from "../index.js"
import { fileHrefToFolderRelativePath } from "./file-href-to-folder-relative-path.js"

const projectPath = exploringServerProjectPath
const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`

startExploringServer({
  projectPath,
  compileIntoRelativePath,
  browserSelfExecuteTemplateRelativePath: "/src/browser-self-execute-template.js",
  HTMLTemplateRelativePath: "/test/template.html",
  explorableMap: {
    [`${folderRelativePath}/**/*.main.js`]: true,
    [`${folderRelativePath}/**/.dist/**`]: false,
  },
  protocol: "https",
  port: 3400,
  forcePort: true,
  livereloading: true,
})
