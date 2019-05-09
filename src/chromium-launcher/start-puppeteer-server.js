import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { startServer, firstService } from "../server/index.js"
import { servePuppeteerHtml } from "./serve-puppeteer-html.js"
import { serveBrowserClientFolder } from "../browser-explorer-server/server-browser-client-folder.js"
import { serveFile } from "../file-service/index.js"
import { ressourceToPathname } from "../urlHelper.js"
import { serveBundle } from "../bundle-service/index.js"

export const startPuppeteerServer = ({
  cancellationToken,
  projectFolder,
  compileServerOrigin,
  browserClientFolderRelative,
  compileInto,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  verbose,
}) => {
  browserClientFolderRelative = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserClientFolderRelative,
  })

  const service = (request) =>
    firstService(
      () =>
        servePuppeteerHtml({
          projectFolder,
          browserClientFolderRelative,
          request,
        }),
      () =>
        redirectBrowserScriptToPuppeteerExecute({
          request,
        }),
      () =>
        servePuppeteerExecute({
          compileServerOrigin,
          compileInto,
          filenameRelative,
          collectNamespace,
          collectCoverage,
          request,
        }),
      () =>
        serveBrowserClientFolder({
          projectFolder,
          browserClientFolderRelative,
          request,
        }),
    )

  return startServer({
    cancellationToken,
    verbose,
    requestToResponse: service,
  })
}

const JSENV_BROWSER_SCRIPT_PATHNAME = "/.jsenv/browser-script.js"
const JSENV_PUPPETEER_EXECUTE_PATHNAME = "/.jsenv/puppeteer-execute.js"
const redirectBrowserScriptToPuppeteerExecute = ({ request: { origin, ressource } }) => {
  if (ressource !== JSENV_BROWSER_SCRIPT_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${origin}${JSENV_PUPPETEER_EXECUTE_PATHNAME}`,
    },
  }
}

const PUPPETEER_EXECUTE_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/launch-chromium/puppeteer-execute-template.js"
const servePuppeteerExecute = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${JSENV_PUPPETEER_EXECUTE_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }

  const pathname = ressourceToPathname(ressource)

  if (pathname !== JSENV_PUPPETEER_EXECUTE_PATHNAME) return null

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative: pathname.slice(1),
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: PUPPETEER_EXECUTE_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {},
    headers,
    format: "iife",
  })
}
