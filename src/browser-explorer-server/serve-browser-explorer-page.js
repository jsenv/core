import { firstService } from "../server/index.js"
import { serveBrowserExplorerPageHTML } from "./serve-browser-explorer-page-html.js"
import { serveBrowserSelfExecute } from "./serve-browser-self-execute.js"

export const serveBrowserExplorerPage = ({
  projectFolder,
  importMapFilenameRelative,
  browserClientFolderRelative,
  compileInto,
  babelConfigMap,
  compileServerOrigin,
  browsableMetaMap,
  request,
}) =>
  firstService(
    () =>
      serveBrowserExplorerPageHTML({
        projectFolder,
        browserClientFolderRelative,
        browsableMetaMap,
        request,
      }),
    () =>
      serveBrowserSelfExecute({
        projectFolder,
        compileServerOrigin,
        browserClientFolderRelative,
        importMapFilenameRelative,
        compileInto,
        babelConfigMap,
        request,
      }),
  )
