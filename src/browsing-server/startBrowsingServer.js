import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { uneval } from "/node_modules/@dmail/uneval/index.js"
import { createCancellationToken } from "/node_modules/@dmail/cancellation/index.js"
import { startServer, serviceCompose } from "../server/index.js"
import { startCompileServer } from "../server-compile/index.js"
import { guard } from "../functionHelper.js"

// required until jsenv importMap bug gets fixed
const { namedValueDescriptionToMetaDescription, selectAllFileInsideFolder } = import.meta.require(
  "@dmail/project-structure",
)

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

  // here instead I have to load systemjs from somewhere
  // then I will use it to load an other distant file
  // like dist/browser-client/browser-client.js
  // capable of running my code, then I will run my code
  // but that will be required only once jsenv use latest jsenv
  generateHTML = ({ compileInto, compileServerOrigin, filenameRelative, browserPlatformHref }) => {
    return `<!doctype html>

<head>
  <title>Untitled</title>
  <meta charset="utf-8" />
</head>

<body>
  <main></main>
  <script src="${browserPlatformHref}"></script>
  <script type="text/javascript">
    window.__platform__.executeCompiledFile({
      "compileInto": ${uneval(compileInto)},
      "compileServerOrigin": ${uneval(compileServerOrigin)},
      "filenameRelative": ${uneval(filenameRelative)}
    })
  </script>
</body>

</html>`
  },
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

  const otherRoute = guard(
    ({ method }) => {
      return method === "GET"
    },
    async ({ ressource }) => {
      const html = await generateHTML({
        compileInto,
        compileServerOrigin,
        browserPlatformHref: getBrowserPlatformHref({ compileInto, compileServerOrigin }),
        filenameRelative: ressource.slice(1),
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
    requestToResponse: serviceCompose(indexRoute, otherRoute),
    startedMessage: ({ origin }) => `browser server started for ${projectFolder} at ${origin}`,
    stoppedMessage: (reason) => `browser server stopped because ${reason}`,
  })
  return browserServer
}

const getBrowserPlatformHref = ({ compileServerOrigin }) =>
  `${compileServerOrigin}/node_modules/@jsenv/core/dist/browser-client/platform.js`

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
