import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { startServer, firstService } from "../server/index.js"
import { serveChromiumIndex } from "./serve-chromium-index.js"
import { serveBrowserExecute } from "../browser-execute-service/index.js"

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
      () =>
        serveChromiumIndex({
          projectFolder,
          browserClientFolderRelative,
          request,
        }),
      () =>
        serveBrowserExecute({
          projectFolder,
          compileServerOrigin,
          browserClientFolderRelative,
          request,
        }),
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
