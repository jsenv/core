import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { startServer, serviceCompose } from "../server/index.js"
import { startCompileServer } from "../server-compile/index.js"
import { guard } from "../functionHelper.js"
import { generateSelfImportIIFE } from "./self-import-iife/generateSelfImportIIFE.js"
import { escapeClosingScriptTag } from "../stringHelper.js"
import { requestToFileResponse } from "../requestToFileResponse/index.js"

// required until jsenv importMap bug gets fixed
const {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
  pathnameToMeta,
} = import.meta.require("@dmail/project-structure")

export const startBrowsingServer = async ({
  cancellationToken = createCancellationToken(),
  importMap,
  projectFolder,
  compileInto,
  compileGroupCount = 2,
  babelConfigMap,
  browsableDescription,
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

  generateHTML = ({ selfExecuteSource }) => `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script type="text/javascript">${selfExecuteSource}</script>
</body>

</html>`,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const metaDescription = namedValueDescriptionToMetaDescription({
    browsable: browsableDescription,
  })

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    importMap,
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

  const browsableRoute = guard(
    ({ method, ressource }) => {
      return method === "GET" && pathnameToMeta({ pathname: ressource, metaDescription }).browsable
    },
    async ({ ressource }) => {
      // selfImportIIFEBundle is mega cool but it make things much slower...
      // is it possible to cache some stuff ?
      // the only variation if filenameRelative
      // so I think it would be better/easier
      // to create this bundle once for all as an IIFE
      // this IIFE would set window.browserClient = the exports from browserPlatform
      // then we would "just" have to load it using a script
      // yeah that's what we "must" do and launchChromium and this one would use it
      // exactly the same approach used for node client in fact

      const selfImportIIFEBundle = await generateSelfImportIIFE({
        cancellationToken,
        importMap,
        projectFolder,
        compileInto,
        babelConfigMap,
        compileServerOrigin,
        filenameRelative: ressource.slice(1),
      })

      const html = await generateHTML({
        compileInto,
        compileServerOrigin,
        filenameRelative: ressource.slice(1),
        selfExecuteSource: escapeClosingScriptTag(selfImportIIFEBundle.code),
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
    requestToResponse: serviceCompose(indexRoute, browsableRoute, (request) =>
      requestToFileResponse(request, { projectFolder }),
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
