import { firstService } from "../server/index.js"
import { serveBrowsingHtml } from "./serve-browsing-html.js"
import { redirectSystemToCompileServer } from "./redirect-system-to-compile-server.js"
import { redirectBrowserScriptToBrowsingBundle } from "./redirect-browser-script-to-browsing-bundle.js"
import { serveBrowsingBundle } from "./serve-browsing-bundle.js"
import { serveBrowsingBundleDynamicData } from "./serve-browsing-bundle-dynamic-data.js"
import { redirectBrowserPlatformToCompileServer } from "./redirect-browser-platform-to-compile-server.js"

export const serveBrowsingPage = ({
  projectFolder,
  importMapFilenameRelative,
  browserClientFolderRelative,
  compileInto,
  babelConfigMap,
  compileServerOrigin,
  browsableMetaMap,
  origin,
  ressource,
  headers,
}) => {
  return firstService(
    () => {
      return serveBrowsingHtml({
        projectFolder,
        browserClientFolderRelative,
        browsableMetaMap,
        ressource,
        headers,
      })
    },
    () => {
      return redirectSystemToCompileServer({
        compileServerOrigin,
        ressource,
      })
    },
    () => {
      return redirectBrowserScriptToBrowsingBundle({
        origin,
        ressource,
      })
    },
    () => {
      return serveBrowsingBundle({
        projectFolder,
        importMapFilenameRelative,
        compileInto,
        babelConfigMap,
        ressource,
        headers,
      })
    },
    () => {
      return serveBrowsingBundleDynamicData({
        projectFolder,
        compileInto,
        babelConfigMap,
        compileServerOrigin,
        ressource,
        headers,
      })
    },
    () => {
      return redirectBrowserPlatformToCompileServer({
        compileServerOrigin,
        ressource,
      })
    },
  )
}
