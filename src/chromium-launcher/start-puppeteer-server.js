import { relativePathInception } from "../inception.js"
import { startServer, firstService } from "../server/index.js"
import { servePuppeteerHtml } from "./serve-puppeteer-html.js"
import { serveBrowserClientFolder } from "../browser-explorer-server/server-browser-client-folder.js"
import { serveFile } from "../file-service/index.js"
import { ressourceToPathname } from "../urlHelper.js"
import { serveBrowserGlobalBundle } from "../bundling/index.js"

const PUPPETEER_EXECUTE_TEMPLATE_RELATIVE_PATH =
  "/src/chromium-launcher/puppeteer-execute-template.js"
const PUPPETEER_EXECUTE_CLIENT_PATHNAME = "/.jsenv/puppeteer-execute.js"
const BROWSER_SCRIPT_CLIENT_PATHNAME = "/.jsenv/browser-script.js"

export const startPuppeteerServer = ({
  cancellationToken,
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  browserClientRelativePath,
  babelPluginMap,
  logLevel,
}) => {
  browserClientRelativePath = relativePathInception({
    projectPathname,
    relativePath: browserClientRelativePath,
  })

  const service = (request) =>
    firstService(
      () =>
        servePuppeteerHtml({
          projectPathname,
          browserClientRelativePath,
          request,
        }),
      () =>
        redirectBrowserScriptToPuppeteerExecute({
          request,
        }),
      () =>
        servePuppeteerExecute({
          projectPathname,
          compileIntoRelativePath,
          importMapRelativePath,
          babelPluginMap,
          request,
        }),
      () =>
        serveBrowserClientFolder({
          projectPathname,
          browserClientRelativePath,
          request,
        }),
    )

  return startServer({
    cancellationToken,
    logLevel,
    requestToResponse: service,
  })
}

const redirectBrowserScriptToPuppeteerExecute = ({ request: { origin, ressource } }) => {
  if (ressource !== BROWSER_SCRIPT_CLIENT_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${origin}${PUPPETEER_EXECUTE_CLIENT_PATHNAME}`,
    },
  }
}

const servePuppeteerExecute = ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  babelPluginMap,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${PUPPETEER_EXECUTE_CLIENT_PATHNAME}__asset__/`)) {
    return serveFile(`${projectPathname}${compileIntoRelativePath}${ressource}`, {
      method,
      headers,
    })
  }

  const pathname = ressourceToPathname(ressource)

  if (pathname !== PUPPETEER_EXECUTE_CLIENT_PATHNAME) return null

  return serveBrowserGlobalBundle({
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    sourceRelativePath: relativePathInception({
      projectPathname,
      relativePath: PUPPETEER_EXECUTE_TEMPLATE_RELATIVE_PATH,
    }),
    compileRelativePath: pathname,
    babelPluginMap,
    headers,
  })
}
