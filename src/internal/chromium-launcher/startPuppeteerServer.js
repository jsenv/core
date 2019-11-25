import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { createLogger } from "@jsenv/logger"
import { servePuppeteerHtml } from "./servePuppeteerHtml.js"

// use import.meta.require to avoid breaking relativePathInception
const { startServer, firstService, serveFile, ressourceToPathname } = import.meta.require(
  "@dmail/server",
)
const { serveBundle } = import.meta.require("@jsenv/compile-server")
const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const PUPPETEER_EXECUTE_CLIENT_PATHNAME = "/.jsenv/puppeteer-execute.js"
const BROWSER_SCRIPT_CLIENT_PATHNAME = "/.jsenv/browser-script.js"

export const startPuppeteerServer = async ({
  cancellationToken,
  projectPath,
  compileIntoRelativePath,
  importMapRelativePath,
  importMapDefaultExtension,
  HTMLTemplateRelativePath,
  puppeteerExecuteTemplateRelativePath,
  babelPluginMap = jsenvBabelPluginMap,
  logLevel = "off",
}) => {
  if (typeof projectPath !== "string")
    throw new TypeError(`projectPath must be a string, got ${projectPath}`)
  if (typeof compileIntoRelativePath !== "string") {
    throw new TypeError(`compileIntoRelativePath must be a string, got ${compileIntoRelativePath}`)
  }

  const projectPathname = operatingSystemPathToPathname(projectPath)

  if (typeof HTMLTemplateRelativePath === "undefined") {
    HTMLTemplateRelativePath = launchChromiumRelativePathInception({
      launchChromiumRelativePath: "/src/template.html",
      projectPathname,
    })
  }
  await assertFile(pathnameToOperatingSystemPath(`${projectPathname}${HTMLTemplateRelativePath}`))

  if (typeof puppeteerExecuteTemplateRelativePath === "undefined") {
    puppeteerExecuteTemplateRelativePath = launchChromiumRelativePathInception({
      launchChromiumRelativePath: "/src/puppeteer-execute-template.js",
      projectPathname,
    })
  }
  await assertFile(
    pathnameToOperatingSystemPath(`${projectPathname}${puppeteerExecuteTemplateRelativePath}`),
  )

  const logger = createLogger({ logLevel })

  return startServer({
    cancellationToken,
    logLevel,
    sendInternalErrorStack: true,
    requestToResponse: (request) =>
      firstService(
        () =>
          servePuppeteerHtml({
            projectPathname,
            HTMLTemplateRelativePath,
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
            importMapDefaultExtension,
            puppeteerExecuteTemplateRelativePath,
            babelPluginMap,
            request,
            logger,
          }),
        () => serveSourcemapNodeModule({ projectPathname, request }),
        () =>
          serveFile(`${projectPathname}${request.ressource}`, {
            method: request.method,
            headers: request.headers,
          }),
      ),
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
  importMapDefaultExtension,
  puppeteerExecuteTemplateRelativePath,
  babelPluginMap,
  request,
  logger,
}) => {
  const { ressource, method, headers } = request

  if (ressource.startsWith(`${PUPPETEER_EXECUTE_CLIENT_PATHNAME}__asset__/`)) {
    return serveFile(`${projectPathname}${compileIntoRelativePath}${ressource}`, {
      method,
      headers,
    })
  }

  const pathname = ressourceToPathname(ressource)

  if (pathname !== PUPPETEER_EXECUTE_CLIENT_PATHNAME) return null

  return serveBundle({
    format: "global",
    projectPathname,
    jsenvProjectPathname: launchChromiumProjectPathname,
    compileIntoRelativePath,
    sourceRelativePath: puppeteerExecuteTemplateRelativePath,
    compileRelativePath: pathname,
    importMapDefaultExtension,
    importMapRelativePath,
    babelPluginMap,
    request,
    logger,
  })
}

const serveSourcemapNodeModule = ({ request: { ressource, method, headers } }) => {
  if (!ressource.startsWith("/node_modules/source-map/")) return null

  const specifier = ressource.slice("/node_modules/".length)
  const location = import.meta.require.resolve(specifier)

  return serveFile(location, {
    method,
    headers,
  })
}
