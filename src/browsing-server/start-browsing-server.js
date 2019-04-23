import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { namedValueDescriptionToMetaDescription, pathnameToMeta } from "@dmail/project-structure"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { startServer, serviceCompose } from "../server/index.js"
import { startCompileServer } from "../compile-server/index.js"
import {
  DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE,
  DEFAULT_COMPILE_INTO,
  DEFAULT_BROWSABLE_DESCRIPTION,
  DEFAULT_BABEL_CONFIG_MAP,
} from "./browsing-server-constant.js"
import { serveBrowsingIndex } from "./serve-browsing-index.js"
import { serveBrowsingPage } from "./serve-browsing-page.js"
import { serveFile } from "../file-service/index.js"

export const startBrowsingServer = async ({
  projectFolder,
  cancellationToken = createCancellationToken(),
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  importMapFilenameRelative = DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  browserClientFolderRelative = DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE,
  browserGroupResolveFilenameRelative = DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  serverCompileInto = DEFAULT_COMPILE_INTO,
  clientCompileInto = DEFAULT_COMPILE_INTO,
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
    serverCompileInto,
    clientCompileInto,
    compileGroupCount,
    babelConfigMap,
    cors,
    protocol,
    ip,
    port: 0, // random available port
    forcePort: false, // no need because random port
    signature,
  })

  const browsingIndexService = ({ ressource }) => {
    if (ressource !== "/") return null
    return serveBrowsingIndex({
      projectFolder,
      metaDescription,
    })
  }

  const browsingPageService = (request) => {
    const browsablePredicate = (ressource) =>
      pathnameToMeta({ pathname: ressource, metaDescription }).browsable

    return serveBrowsingPage({
      projectFolder,
      browserClientFolderRelative,
      compileServerOrigin,
      browsablePredicate,
      ...request,
    })
  }

  const browserClientFileService = ({ ressource, method, headers }) => {
    return serveFile(`${projectFolder}/${browserClientFolderRelative}${ressource}`, {
      method,
      headers,
    })
  }

  const browserServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    forcePort,
    requestToResponse: serviceCompose(
      browsingIndexService,
      browsingPageService,
      browserClientFileService,
    ),
    startedMessage: ({ origin }) => `browser server started for ${projectFolder} at ${origin}`,
    stoppedMessage: (reason) => `browser server stopped because ${reason}`,
  })

  return browserServer
}
