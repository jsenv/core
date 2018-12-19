import { createCancellationToken } from "@dmail/cancellation"
import { forEachRessourceMatching } from "@dmail/project-structure"
import { open as serverOpen, createRequestPredicate, serviceCompose } from "../server/index.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { guard } from "../functionHelper.js"
import {
  createPlatformSetupSource,
  createPlatformImportFileSource,
} from "../platform/browser/platformSource.js"
import { getBrowserPlatformRemoteURL } from "../platform/browser/remoteURL.js"

export const listFilesToExecute = (localRoot) => {
  return forEachRessourceMatching(
    localRoot,
    {
      "index.js": { js: true },
      "src/**/*.js": { js: true },
    },
    ({ js }) => js,
    (file) => file,
  )
}

const getIndexPageHTML = async ({ localRoot }) => {
  const files = await listFilesToExecute(localRoot)

  return `<!doctype html>

  <head>
    <title>Project root</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
			<h1>${localRoot}</h1>
			<p>Sample file to execute: </p>
			<ul>
				${files
          .map((file) => {
            return `<li><a href="/${file}">${file}</a></li>`
          })
          .join("")}
			</ul>
    </main>
  </body>

  </html>`
}

export const open = async ({
  cancellationToken = createCancellationToken(),
  protocol = "http",
  ip = "127.0.0.1",
  port = 3000,
  forcePort = true,

  localRoot,
  compileInto,
  compileService,
  hotreload = false,

  sourceCacheStrategy,
  sourceCacheIgnore,
}) => {
  const server = await serverCompileOpen({
    cancellationToken,
    localRoot,
    compileInto,
    protocol, // reuse browser protocol
    compileService,
    sourceCacheStrategy,
    sourceCacheIgnore,
  })

  const remoteRoot = server.origin

  const indexRoute = guard(
    createRequestPredicate({
      ressource: "",
      method: "GET",
    }),
    async () => {
      const html = await getIndexPageHTML({
        localRoot,
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

  return serverOpen({
    cancellationToken,
    protocol,
    ip,
    port,
    forcePort,
    requestToResponse: serviceCompose(indexRoute, otherRoute),
    openedMessage: ({ origin }) => `executing ${localRoot} at ${origin}`,
    closedMessage: (reason) => `browser server closed because ${reason}`,
  })
}
