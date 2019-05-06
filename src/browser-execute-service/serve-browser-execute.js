import { WELL_KNOWN_SYSTEM_PATHNAME } from "../compile-server/system-service/index.js"
import { WELL_KNOWN_BROWSER_PLATFORM_PATHNAME } from "../browser-platform-service/index.js"
import { serveBundle } from "../bundle-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { serveFile } from "../file-service/index.js"
import { firstService } from "../server/index.js"

const BROWSER_EXECUTE_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browser-execute-service/browser-execute-template.js"

export const WELL_KNOWN_BROWSER_EXECUTE_PATHNAME = "/.jsenv-well-known/browser-execute.js"

export const serveBrowserExecute = ({
  projectFolder,
  compileServerOrigin,
  browserClientFolderRelative,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  request,
}) =>
  firstService(
    () =>
      serveBrowserExecuteBundle({
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
      redirectBrowserPlatformToCompileServer({
        compileServerOrigin,
        request,
      }),
    () =>
      serveBrowserClientFolder({
        projectFolder,
        browserClientFolderRelative,
        request,
      }),
  )

const serveBrowserExecuteBundle = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${WELL_KNOWN_BROWSER_EXECUTE_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }

  if (ressource !== WELL_KNOWN_BROWSER_EXECUTE_PATHNAME) return null

  const filenameRelative = ressource.slice(1)

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative,
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: BROWSER_EXECUTE_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {},
    headers,
  })
}

const redirectSystemToCompileServer = ({ compileServerOrigin, request: { ressource } }) => {
  if (ressource !== WELL_KNOWN_SYSTEM_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${compileServerOrigin}${ressource}`,
    },
  }
}

const redirectBrowserPlatformToCompileServer = ({
  compileServerOrigin,
  request: { ressource },
}) => {
  if (ressource !== WELL_KNOWN_BROWSER_PLATFORM_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${compileServerOrigin}${ressource}`,
    },
  }
}

const serveBrowserClientFolder = ({
  projectFolder,
  browserClientFolderRelative,
  request: { ressource, method, headers },
}) => {
  return serveFile(`${projectFolder}/${browserClientFolderRelative}${ressource}`, {
    method,
    headers,
  })
}
