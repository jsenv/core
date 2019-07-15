import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startExploringServer } from "../../index.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`

startExploringServer({
  projectPath,
  compileIntoRelativePath,
  browserSelfExecuteTemplateRelativePath: "/src/exploring-server/browser-self-execute-template.js",
  browserClientRelativePath: "/src/browser-client",
  browserPlatformRelativePath: "/src/browser-platform-service/browser-platform/index.js",
  browserGroupResolverPath: "/src/balancing/browser-group-resolver",
  explorableMap: {
    [`${folderJsenvRelativePath}/**/*.main.js`]: true,
    [`${folderJsenvRelativePath}/**/.dist/**`]: false,
  },
  protocol: "https",
  port: 3400,
  forcePort: true,
  livereloading: true,
})
