import { createCancellationToken } from "@dmail/cancellation"
import { startServer, createRequestPredicate, serviceCompose } from "../server/index.js"
import { startCompileServer } from "../server-compile/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { guard } from "../functionHelper.js"
import {
  createPlatformSetupSource,
  createPlatformImportFileSource,
} from "../platform/browser/platformSource.js"
import { getBrowserPlatformRemoteURL } from "../platform/browser/remoteURL.js"

export const startBrowserServer = async ({
  cancellationToken = createCancellationToken(),
  localRoot,
  compileInto,
  compileGroupCount,
  pluginMap,
  pluginCompatMap,
  platformUsageMap,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  instrumentPredicate,
  watch,
  watchPredicate,
  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,
  preventCors = false,
  protocol = "http",
  ip = "127.0.0.1",
  port = 3000,
  forcePort = true,
  signature,
  executableFiles = [],
}) => {
  const { origin: remoteRoot } = await startCompileServer({
    cancellationToken,
    localRoot,
    compileInto,
    compileGroupCount,
    pluginMap,
    pluginCompatMap,
    platformUsageMap,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    instrumentPredicate,
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
    createRequestPredicate({
      ressource: "",
      method: "GET",
    }),
    async () => {
      const html = await getIndexPageHTML({
        executableFiles,
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
    createRequestPredicate({
      ressource: "*",
      method: "GET",
    }),
    async ({ ressource }) => {
      const html = await createHTMLForBrowser({
        scriptRemoteList: [{ url: getBrowserPlatformRemoteURL({ remoteRoot, compileInto }) }],
        scriptInlineList: [
          {
            source: createPlatformSetupSource({
              remoteRoot,
              compileInto,
            }),
          },
          {
            source: createPlatformImportFileSource(ressource, {}),
          },
        ],
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
    startedMessage: ({ origin }) => `browser server started for ${localRoot} at ${origin}`,
    stoppedMessage: (reason) => `browser server stopped because ${reason}`,
  })
  return browserServer
}

const getIndexPageHTML = async ({ localRoot, executableFiles }) => {
  return `<!doctype html>

  <head>
    <title>Project root</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
      <h1>${localRoot}</h1>
      <p>List of executable file: </p>
      <ul>
        ${executableFiles.map((file) => `<li><a href="/${file}">${file}</a></li>`).join("")}
      </ul>
    </main>
  </body>

  </html>`
}
