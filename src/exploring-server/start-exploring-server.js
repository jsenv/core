/* eslint-disable import/max-dependencies */
import { createCancellationToken } from "@dmail/cancellation"
import { namedValueDescriptionToMetaDescription } from "@dmail/project-structure"
import { startServer, firstService, serveFile } from "@dmail/server"
import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { startCompileServer } from "../compile-server/index.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"
import { readProjectImportMap } from "../import-map/readProjectImportMap.js"
import { relativePathInception } from "../JSENV_PATH.js"
import { serveExploringIndex } from "./serve-exploring-index.js"
import { serveExploringPage } from "./serve-exploring-page.js"
import {
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_BROWSER_CLIENT_RELATIVE_PATH,
  DEFAULT_BROWSER_SELF_EXECUTE_TEMPLATE_RELATIVE_PATH,
  DEFAULT_EXPLORABLE_MAP,
} from "./exploring-server-constant.js"
import { assertFolder, assertFile } from "./filesystem-assertions.js"

export const startExploringServer = async ({
  cancellationToken = createCancellationToken(),
  projectPath,
  compileIntoRelativePath,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  importDefaultExtension,
  browserClientRelativePath = DEFAULT_BROWSER_CLIENT_RELATIVE_PATH,
  browserSelfExecuteTemplateRelativePath = DEFAULT_BROWSER_SELF_EXECUTE_TEMPLATE_RELATIVE_PATH,
  browserPlatformRelativePath,
  browserGroupResolverPath,
  babelPluginMap,
  compileGroupCount = 2,
  explorableMap = DEFAULT_EXPLORABLE_MAP,
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  keepProcessAlive = true,
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  forcePort = false,
  signature,
  compileServerLogLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectPath)

  const importMap = await readProjectImportMap({ projectPathname, importMapRelativePath })

  browserClientRelativePath = relativePathInception({
    projectPathname,
    importMap,
    relativePath: browserClientRelativePath,
  })
  browserSelfExecuteTemplateRelativePath = relativePathInception({
    projectPathname,
    importMap,
    relativePath: browserSelfExecuteTemplateRelativePath,
  })

  await assertFolder(
    pathnameToOperatingSystemPath(`${projectPathname}${browserClientRelativePath}`),
  )
  await assertFile(
    pathnameToOperatingSystemPath(`${projectPathname}${browserClientRelativePath}/index.html`),
  )

  const metaDescription = namedValueDescriptionToMetaDescription({
    browsable: explorableMap,
  })

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    projectPath,
    compileIntoRelativePath,
    importMapRelativePath,
    importDefaultExtension,
    browserPlatformRelativePath,
    browserGroupResolverPath,
    compileGroupCount,
    babelPluginMap,
    cors,
    protocol,
    ip,
    port: 0, // random available port
    forcePort: false, // no need because random port
    signature,
    logLevel: compileServerLogLevel,
  })

  const service = (request) =>
    firstService(
      () =>
        serveExploringIndex({
          projectPathname,
          metaDescription,
          request,
        }),
      () =>
        serveExploringPage({
          compileServerOrigin,
          projectPathname,
          compileIntoRelativePath,
          importMapRelativePath,
          browserClientRelativePath,
          browserSelfExecuteTemplateRelativePath,
          babelPluginMap,
          browsableMetaMap: metaDescription,
          request,
        }),
      () =>
        serveFile(`${projectPathname}${request.ressource}`, {
          method: request.method,
          headers: request.headers,
        }),
    )

  const browserServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    forcePort,
    requestToResponse: service,
    logLevel,
    keepProcessAlive,
  })

  return browserServer
}
