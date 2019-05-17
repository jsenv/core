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
  DEFAULT_BABEL_CONFIG_MAP,
} from "./browser-explorer-server-constant.js"
import { serveBrowserExplorerIndex } from "./serve-browser-explorer-index.js"
import { serveBrowserExplorerPage } from "./serve-browser-explorer-page.js"
import { operatingSystemFilenameToPathname } from "../operating-system-filename.js"

export const startBrowserExplorerServer = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileIntoRelativePath = DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  browserClientRelativePath = DEFAULT_BROWSER_CLIENT_RELATIVE_PATH,
  browserGroupResolverPath = DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  compileGroupCount = 2,
  browsableDescription = DEFAULT_BROWSABLE_DESCRIPTION,
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  forcePort = false,
  signature,
}) => {
  const projectPathname = operatingSystemFilenameToPathname(projectFolder)

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
    babelConfigMap,
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
          babelConfigMap,
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
