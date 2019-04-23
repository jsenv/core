import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
  pathnameToMeta,
} from "@dmail/project-structure"
import { startServer, serviceCompose } from "../server/index.js"
import { startCompileServer } from "../server-compile/index.js"
import { guard } from "../functionHelper.js"
import { serveFile } from "../file-service/index.js"
import {
  DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE,
  DEFAULT_COMPILE_INTO,
  DEFAULT_BROWSABLE_DESCRIPTION,
  DEFAULT_BABEL_CONFIG_MAP,
} from "./browsing-server-constant.js"
import { serveBrowsingPage } from "./serve-browsing-page.js"

export const startBrowsingServer = async ({
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
  const metaDescription = namedValueDescriptionToMetaDescription({
    browsable: browsableDescription,
  })
  const browsablePredicate = (ressource) =>
    pathnameToMeta({ pathname: ressource, metaDescription }).browsable

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

  const indexPageService = guard(
    ({ ressource, method }) => {
      if (method !== "GET") return false
      if (ressource !== "/") return false
      return true
    },
    async () => {
      const browsableFilenameRelativeArray = await selectAllFileInsideFolder({
        pathname: projectFolder,
        metaDescription,
        predicate: ({ browsable }) => browsable,
        transformFile: ({ filenameRelative }) => filenameRelative,
      })

      const html = await getIndexPageHTML({
        projectFolder,
        browsableFilenameRelativeArray,
      })

      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "text/html",
          "content-length": Buffer.byteLength(html),
        },
        body: html,
      }
    },
  )

  const browsingPageService = (request) =>
    serveBrowsingPage({
      projectFolder,
      browserClientFolderRelative,
      compileServerOrigin,
      browsablePredicate,
      ...request,
    })

  const browsingClientFolderService = ({ ressource, method, headers }) => {
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
      indexPageService,
      browsingPageService,
      browsingClientFolderService,
    ),
    startedMessage: ({ origin }) => `browser server started for ${projectFolder} at ${origin}`,
    stoppedMessage: (reason) => `browser server stopped because ${reason}`,
  })

  return browserServer
}

const getIndexPageHTML = async ({ projectFolder, browsableFilenameRelativeArray }) => {
  return `<!doctype html>

  <head>
    <title>Browsing ${projectFolder}</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
      <h1>${projectFolder}</h1>
      <p>List of path to browse: </p>
      <ul>
        ${browsableFilenameRelativeArray
          .sort()
          .map(
            (filenameRelative) => `<li><a href="/${filenameRelative}">${filenameRelative}</a></li>`,
          )
          .join("")}
      </ul>
    </main>
  </body>
  </html>`
}
