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
}) =>
  firstService(
    () =>
      serveBrowsingHtml({
        projectFolder,
        browserClientFolderRelative,
        browsableMetaMap,
        request,
      }),
    () =>
      redirectBrowserScriptToSelfImport({
        request,
      }),
    () =>
      serveSelfImport({
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
      serveSelfImportDynamicData({
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
