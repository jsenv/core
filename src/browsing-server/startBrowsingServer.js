import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
  pathnameToMeta,
} from "@dmail/project-structure"
import { uneval } from "@dmail/uneval"
import { startServer, serviceCompose } from "../server/index.js"
import { startCompileServer } from "../server-compile/index.js"
import { guard } from "../functionHelper.js"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import {
  BROWSING_SERVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  BROWSING_SERVER_DEFAULT_COMPILE_INTO,
  BROWSING_SERVER_DEFAULT_BROWSABLE_DESCRIPTION,
  BROWSING_SERVER_DEFAULT_BABEL_CONFIG_MAP,
} from "./browsing-server-constant.js"

export const startBrowsingServer = async ({
  projectFolder,
  babelConfigMap = BROWSING_SERVER_DEFAULT_BABEL_CONFIG_MAP,
  cancellationToken = createCancellationToken(),
  importMapFilenameRelative = BROWSING_SERVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  compileInto = BROWSING_SERVER_DEFAULT_COMPILE_INTO,
  compileGroupCount = 2,
  browsableDescription = BROWSING_SERVER_DEFAULT_BROWSABLE_DESCRIPTION,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  watch,
  watchPredicate,
  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,
  preventCors = false,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  forcePort = false,
  signature,

  generateHTML = ({ filenameRelative, systemScriptSrc, selfExecuteScriptSrc }) => `<!doctype html>

<head>
  <title>browsing ${filenameRelative}</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="${systemScriptSrc}"></script>
  <script src="${selfExecuteScriptSrc}"></script>
</body>

</html>`,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const metaDescription = namedValueDescriptionToMetaDescription({
    browsable: browsableDescription,
  })

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    importMapFilenameRelative,
    projectFolder,
    compileInto,
    compileGroupCount,
    babelConfigMap,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    watch,
    watchPredicate,
    sourceCacheStrategy,
    sourceCacheIgnore,
    preventCors,
    protocol,
    ip,
    port: 0, // random available port
    forcePort: false, // no need because random port
    signature,
  })

  const indexRoute = guard(
    ({ ressource, method }) => {
      if (ressource !== "/") return false
      if (method !== "GET") return false
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

  const selfExecuteScriptRoute = guard(
    ({ method, ressource }) => {
      if (method !== "GET") return false
      if (ressource.endsWith("__execute__.js")) return true
      return false
    },
    async ({ ressource }) => {
      const filenameRelative = ressource.slice(1, -`__execute__.js`.length)
      const source = generateSelfImportSource({
        compileInto,
        compileServerOrigin,
        filenameRelative,
      })

      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/javascript",
          "content-length": Buffer.byteLength(source),
        },
        body: source,
      }
    },
  )

  const browsableRoute = guard(
    ({ method, ressource }) => {
      return method === "GET" && pathnameToMeta({ pathname: ressource, metaDescription }).browsable
    },
    async ({ ressource }) => {
      const html = await generateHTML({
        compileInto,
        compileServerOrigin,
        filenameRelative: ressource.slice(1),
        systemScriptSrc: `${compileServerOrigin}/node_modules/@jsenv/core/dist/browser-client/system.js`,
        selfExecuteScriptSrc: `${ressource}__execute__.js`,
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

  const browserServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    forcePort,
    requestToResponse: serviceCompose(
      indexRoute,
      selfExecuteScriptRoute,
      browsableRoute,
      (request) => requestToFileResponse(request, { projectFolder }),
    ),
    startedMessage: ({ origin }) => `browser server started for ${projectFolder} at ${origin}`,
    stoppedMessage: (reason) => `browser server stopped because ${reason}`,
  })
  return browserServer
}

const generateSelfImportSource = ({ compileInto, compileServerOrigin, filenameRelative }) => `
window.System.import(${uneval(
  computeBrowserClientHref({ compileServerOrigin }),
)}).then(({ executeCompiledFile }) => {
  executeCompiledFile({
    compileInto: ${uneval(compileInto)},
    compileServerOrigin: ${uneval(compileServerOrigin)},
    filenameRelative: ${uneval(filenameRelative)},
  })
})
`

const computeBrowserClientHref = ({ compileServerOrigin }) =>
  `${compileServerOrigin}/node_modules/@jsenv/core/dist/browser-client/browserClient.js`

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
