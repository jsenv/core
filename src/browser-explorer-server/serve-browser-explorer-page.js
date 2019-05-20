import { firstService } from "../server/index.js"
import { serveBrowserExplorerPageHTML } from "./serve-browser-explorer-page-html.js"
import { serveBrowserSelfExecute } from "./serve-browser-self-execute.js"

export const serveBrowserExplorerPage = ({
  compileServerOrigin,
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  browserClientRelativePath,
  babelPluginMap,
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
        compileServerOrigin,
        projectPathname,
        importMapRelativePath,
        compileIntoRelativePath,
        browserClientRelativePath,
        babelPluginMap,
        request,
      }),
  )
