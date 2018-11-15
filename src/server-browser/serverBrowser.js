import { open as serverOpen, createRequestPredicate, serviceCompose } from "../server/index.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { createHTMLForBrowser } from "../createHTMLForBrowser.js"
import { guard } from "../functionHelper.js"
import {
  getBrowserSystemRemoteURL,
  getBrowserPlatformRemoteURL,
  getCompileMapLocalURL,
} from "../compilePlatformAndSystem.js"
import { createBrowserPlatformSource, createBrowserExecuteSource } from "../createBrowserSource.js"
import { createCancellationToken } from "../cancellation/index.js"
import { readFile } from "../fileHelper.js"
import { forEachRessourceMatching } from "@dmail/project-structure"

export const listFilesToExecute = (localRoot) => {
  return forEachRessourceMatching(
    localRoot,
    {
      "index.js": { js: true },
      "src/**/*.js": { js: true },
    },
    ({ js }) => js,
    ({ relativeName }) => relativeName,
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
      const compileMap = JSON.parse(
        await readFile(getCompileMapLocalURL({ localRoot, compileInto })),
      )

      const html = await createHTMLForBrowser({
        scriptRemoteList: [
          { url: getBrowserSystemRemoteURL({ remoteRoot, compileInto }) },
          { url: getBrowserPlatformRemoteURL({ remoteRoot, compileInto }) },
        ],
        scriptInlineList: [
          {
            source: createBrowserPlatformSource({
              remoteRoot,
              compileInto,
              compileMap,
              hotreload,
              hotreloadSSERoot: remoteRoot,
            }),
          },
          {
            source: createBrowserExecuteSource({
              file: ressource,
            }),
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
