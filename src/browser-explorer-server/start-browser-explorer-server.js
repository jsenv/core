import { createCancellationToken } from "@dmail/cancellation"
import { namedValueDescriptionToMetaDescription } from "@dmail/project-structure"
import { relativePathInception } from "../inception.js"
import { startServer, firstService } from "../server/index.js"
import { startCompileServer } from "../compile-server/index.js"
import {
  DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_BROWSER_CLIENT_RELATIVE_PATH,
  DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_BROWSABLE_DESCRIPTION,
  DEFAULT_BABEL_PLUGIN_MAP,
} from "./browser-explorer-server-constant.js"
import { serveBrowserExplorerIndex } from "./serve-browser-explorer-index.js"
import { serveBrowserExplorerPage } from "./serve-browser-explorer-page.js"
import { operatingSystemPathToPathname } from "../operating-system-path.js"

export const startBrowserExplorerServer = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileIntoRelativePath = DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  browserClientRelativePath = DEFAULT_BROWSER_CLIENT_RELATIVE_PATH,
  browserGroupResolverPath = DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  babelPluginMap = DEFAULT_BABEL_PLUGIN_MAP,
  compileGroupCount = 2,
  browsableDescription = DEFAULT_BROWSABLE_DESCRIPTION,
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  forcePort = false,
  signature,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectFolder)

  const metaDescription = namedValueDescriptionToMetaDescription({
    browsable: browsableDescription,
  })

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    projectFolder,
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
  })

  const service = (request) =>
    firstService(
      () =>
        serveBrowserExplorerIndex({
          projectPathname,
          metaDescription,
          request,
        }),
      () =>
        serveBrowserExplorerPage({
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
  })

  return browserServer
}
