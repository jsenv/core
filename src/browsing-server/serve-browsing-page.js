import { firstService } from "../server/index.js"
import { serveBrowsingHtml } from "./serve-browsing-html.js"
import { redirectSystemToCompileServer } from "./redirect-system-to-compile-server.js"
import { redirectBrowserScriptToSelfImport } from "./redirect-browser-script-to-self-import.js"
import { serveSelfImport } from "./serve-self-import.js"
import { serveSelfImportDynamicData } from "./serve-self-import-dynamic-data.js"
import { redirectBrowserPlatformToCompileServer } from "./redirect-browser-platform-to-compile-server.js"

export const serveBrowsingPage = ({
  projectFolder,
  importMapFilenameRelative,
  browserClientFolderRelative,
  compileInto,
  babelConfigMap,
  compileServerOrigin,
  browsableMetaMap,
  request,
}) => {
  return firstService(
    () => {
      return serveBrowsingHtml({
        projectFolder,
        browserClientFolderRelative,
        browsableMetaMap,
        request,
      })
    },
    () => {
      return redirectSystemToCompileServer({
        compileServerOrigin,
        request,
      })
    },
    () => {
      return redirectBrowserScriptToSelfImport({
        request,
      })
    },
    () => {
      return serveSelfImport({
        projectFolder,
        importMapFilenameRelative,
        compileInto,
        babelConfigMap,
        request,
      })
    },
    () => {
      return serveSelfImportDynamicData({
        projectFolder,
        compileInto,
        babelConfigMap,
        compileServerOrigin,
        request,
      })
    },
    () => {
      return redirectBrowserPlatformToCompileServer({
        compileServerOrigin,
        request,
      })
    },
  )
}
