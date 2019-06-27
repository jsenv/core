import { createCancellationToken } from "@dmail/cancellation"
import { namedValueDescriptionToMetaDescription } from "@dmail/project-structure"
import { startServer, firstService } from "@dmail/server"
import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import { relativePathInception } from "../inception.js"
import { startCompileServer } from "../compile-server/index.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"
import { serveExploringIndex } from "./serve-exploring-index.js"
import { serveExploringPage } from "./serve-exploring-page.js"
import {
  DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_BROWSER_CLIENT_RELATIVE_PATH,
  DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_EXPLORABLE_MAP,
  DEFAULT_BABEL_PLUGIN_MAP,
} from "./exploring-server-constant.js"

export const startExploringServer = async ({
  cancellationToken = createCancellationToken(),
  projectPath,
  compileIntoRelativePath = DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  browserClientRelativePath = DEFAULT_BROWSER_CLIENT_RELATIVE_PATH,
  browserGroupResolverPath = DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  babelPluginMap = DEFAULT_BABEL_PLUGIN_MAP,
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

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    projectPath,
    compileIntoRelativePath,
    importMapRelativePath,
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
          browserClientRelativePath: relativePathInception({
            projectPathname,
            relativePath: browserClientRelativePath,
          }),
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
