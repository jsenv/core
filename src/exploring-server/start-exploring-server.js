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
import { jsenvRelativePathInception } from "../JSENV_PATH.js"
import { assertFolder, assertFile } from "../filesystem-assertions.js"
import { serveExploringIndex } from "./serve-exploring-index.js"
import { serveExploringPage } from "./serve-exploring-page.js"
import {
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_EXPLORABLE_MAP,
} from "./exploring-server-constant.js"

export const startExploringServer = async ({
  cancellationToken = createCancellationToken(),
  projectPath,
  compileIntoRelativePath,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  importDefaultExtension,
  browserClientRelativePath,
  browserSelfExecuteTemplateRelativePath,
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
  livereloading = false,
  signature,
  compileServerLogLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectPath)

  if (typeof browserClientRelativePath === "undefined") {
    browserClientRelativePath = jsenvRelativePathInception({
      jsenvRelativePath: "/src/browser-client",
      projectPathname,
    })
  }
  await assertFolder(
    pathnameToOperatingSystemPath(`${projectPathname}${browserClientRelativePath}`),
  )
  await assertFile(
    pathnameToOperatingSystemPath(`${projectPathname}${browserClientRelativePath}/index.html`),
  )

  if (typeof browserSelfExecuteTemplateRelativePath === "undefined") {
    browserSelfExecuteTemplateRelativePath = jsenvRelativePathInception({
      jsenvRelativePath: "/src/exploring-server/browser-self-execute-template.js",
      projectPathname,
    })
  }
  await assertFile(
    pathnameToOperatingSystemPath(`${projectPathname}${browserSelfExecuteTemplateRelativePath}`),
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
    livereloadingServerSentEvents: livereloading,
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
          livereloading,
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
    signature,
    requestToResponse: service,
    logLevel,
    keepProcessAlive,
  })

  return browserServer
}
