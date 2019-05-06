import { firstService } from "../server/index.js"
import { serveBrowserExplorerPageHTML } from "./serve-browser-explorer-page-html.js"
import { redirectSystemToCompileServer } from "./redirect-system-to-compile-server.js"
import { redirectBrowserScriptToBrowserSelfExecute } from "./redirect-browser-script-to-browser-self-execute.js"
import { serveBrowserSelfExecute } from "./serve-browser-self-execute.js"
import { serveBrowserSelfExecuteDynamicData } from "./serve-browser-self-execute-dynamic-data.js"
import { redirectBrowserPlatformToCompileServer } from "./redirect-browser-platform-to-compile-server.js"

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
      redirectBrowserScriptToBrowserSelfExecute({
        request,
      }),
    () =>
      serveBrowserSelfExecute({
        projectFolder,
        importMapFilenameRelative,
        compileInto,
        babelConfigMap,
        request,
      }),
    () =>
      redirectSystemToCompileServer({
        compileServerOrigin,
        request,
      }),
    () =>
      serveBrowserSelfExecuteDynamicData({
        projectFolder,
        compileInto,
        babelConfigMap,
        compileServerOrigin,
        request,
      }),
    () =>
      redirectBrowserPlatformToCompileServer({
        compileServerOrigin,
        request,
      }),
  )
