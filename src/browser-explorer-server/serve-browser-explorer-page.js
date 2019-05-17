import { firstService } from "../server/index.js"
import { serveBrowserExplorerPageHTML } from "./serve-browser-explorer-page-html.js"
import { serveBrowserSelfExecute } from "./serve-browser-self-execute.js"

export const serveBrowserExplorerPage = ({
  projectPathname,
  compileServerOrigin,
  importMapRelativePath,
  browserClientRelativePath,
  compileIntoRelativePath,
  babelConfigMap,
  browsableMetaMap,
  request,
}) =>
  firstService(
    () =>
      serveBrowserExplorerPageHTML({
        projectPathname,
        browserClientRelativePath,
        browsableMetaMap,
        request,
      }),
    () =>
      serveBrowserSelfExecute({
        projectPathname,
        compileServerOrigin,
        browserClientRelativePath,
        importMapRelativePath,
        compileIntoRelativePath,
        babelConfigMap,
        request,
      }),
  )
