import { createCancellationToken } from "@dmail/cancellation"
import { namedValueDescriptionToMetaDescription } from "@dmail/project-structure"
import { startServer, firstService } from "@dmail/server"
import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { startCompileServer } from "../compile-server/index.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"
import { serveExploringIndex } from "./serve-exploring-index.js"
import { serveExploringPage } from "./serve-exploring-page.js"
import {
  DEFAULT_BROWSER_CLIENT_RELATIVE_PATH,
  DEFAULT_BROWSER_SELF_EXECUTE_TEMPLATE_RELATIVE_PATH,
  DEFAULT_EXPLORABLE_MAP,
} from "./exploring-server-constant.js"
import { assertFolder, assertFile } from "./filesystem-assertions.js"

export const startExploringServer = async ({
  cancellationToken = createCancellationToken(),
  projectPath,
  compileIntoRelativePath,
  importMapRelativePath,
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

  const metaDescription = namedValueDescriptionToMetaDescription({
    browsable: explorableMap,
  })

  const browserClientFolderPath = pathnameToOperatingSystemPath(
    `${projectPathname}${browserClientRelativePath}`,
  )
  await assertFolder(browserClientFolderPath)

  const browserClientIndexPath = pathnameToOperatingSystemPath(
    `${projectPathname}${browserClientRelativePath}/index.html`,
  )
  await assertFile(browserClientIndexPath)

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
