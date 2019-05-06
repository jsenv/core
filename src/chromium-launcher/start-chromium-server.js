import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { startServer, firstService } from "../server/index.js"
import { serveBrowserClientFolder } from "../browsing-server/serve-browser-client-folder.js"
import { redirectSystemToCompileServer } from "../browsing-server/redirect-system-to-compile-server.js"
import { redirectBrowserScriptToSystem } from "./redirect-browser-script-to-system.js"
import { serveChromiumIndex } from "./serve-chromium-index.js"

export const startChromiumServer = ({
  cancellationToken,
  projectFolder,
  compileServerOrigin,
  browserClientFolderRelative,
  protocol,
  ip,
  port,
  verbose,
}) => {
  browserClientFolderRelative = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserClientFolderRelative,
  })

  const service = (request) =>
    firstService(
      () => serveChromiumIndex({ projectFolder, browserClientFolderRelative, request }),
      () => redirectBrowserScriptToSystem({ compileServerOrigin, request }),
      () => redirectSystemToCompileServer({ compileServerOrigin, request }),
      () => serveBrowserClientFolder({ projectFolder, browserClientFolderRelative, request }),
    )

  return startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    verbose,
    requestToResponse: service,
  })
}
