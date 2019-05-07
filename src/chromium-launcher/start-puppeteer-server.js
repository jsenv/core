import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { startServer, firstService } from "../server/index.js"
import { servePuppeteerHtml } from "./serve-puppeteer-html.js"
import { serveBrowserClientFolder } from "../browser-explorer-server/server-browser-client-folder.js"

export const startPuppeteerServer = ({
  cancellationToken,
  projectFolder,
  compileServerOrigin,
  browserClientFolderRelative,
  compileInto,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  verbose,
}) => {
  browserClientFolderRelative = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserClientFolderRelative,
  })

  const service = (request) =>
    firstService(
      () =>
        servePuppeteerHtml({
          projectFolder,
          browserClientFolderRelative,
          request,
        }),
      () =>
        redirectBrowserScriptToPuppeteerExecute({
          request,
        }),
      () =>
        servePuppeteerExecute({
          compileServerOrigin,
          compileInto,
          filenameRelative,
          collectNamespace,
          collectCoverage,
          request,
        }),
      () =>
        serveBrowserClientFolder({
          projectFolder,
          browserClientFolderRelative,
          request,
        }),
    )

  return startServer({
    cancellationToken,
    verbose,
    requestToResponse: service,
  })
}

const redirectBrowserScriptToPuppeteerExecute = () => {}

const servePuppeteerExecute = () => {}
