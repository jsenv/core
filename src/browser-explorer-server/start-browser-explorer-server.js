import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { namedValueDescriptionToMetaDescription } from "@dmail/project-structure"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { startServer, firstService } from "../server/index.js"
import { startCompileServer } from "../compile-server/index.js"
import {
  DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE,
  DEFAULT_COMPILE_INTO,
  DEFAULT_BROWSABLE_DESCRIPTION,
  DEFAULT_BABEL_CONFIG_MAP,
} from "./browser-explorer-server-constant.js"
import { serveBrowserExplorerIndex } from "./serve-browser-explorer-index.js"
import { serveBrowserExplorerPage } from "./serve-browser-explorer-page.js"

export const startBrowserExplorerServer = async ({
  projectFolder,
  cancellationToken = createCancellationToken(),
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  importMapFilenameRelative = DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  browserClientFolderRelative = DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE,
  browserGroupResolveFilenameRelative = DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  compileInto = DEFAULT_COMPILE_INTO,
  compileGroupCount = 2,
  browsableDescription = DEFAULT_BROWSABLE_DESCRIPTION,
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  forcePort = false,
  signature,
}) => {
  projectFolder = normalizePathname(projectFolder)

  browserClientFolderRelative = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserClientFolderRelative,
  })

  const metaDescription = namedValueDescriptionToMetaDescription({
    browsable: browsableDescription,
  })

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative,
    browserGroupResolveFilenameRelative,
    compileInto,
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
          projectFolder,
          metaDescription,
          request,
        }),
      () =>
        serveBrowserExplorerPage({
          projectFolder,
          importMapFilenameRelative,
          browserClientFolderRelative,
          compileInto,
          babelConfigMap,
          compileServerOrigin,
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
