import { createCancellationToken } from "@dmail/cancellation"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { startServer, firstService } from "../server/index.js"
import { serveBrowserClientFolder } from "../browsing-server/serve-browser-client-folder.js"
import { redirectSystemToCompileServer } from "../browsing-server/redirect-system-to-compile-server.js"
import { redirectBrowserScriptToSystem } from "./redirect-browser-script-to-system.js"

const DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE = ""

export const startChromiumServer = ({
  projectFolder,
  cancellationToken = createCancellationToken(),
  browserClientFolderRelative = DEFAULT_BROWSER_CLIENT_FOLDER_RELATIVE,
  compileServerOrigin,
}) => {
  browserClientFolderRelative = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserClientFolderRelative,
  })

  const service = (request) =>
    firstService(
      () => redirectBrowserScriptToSystem({ compileServerOrigin, request }),
      () => redirectSystemToCompileServer({ compileServerOrigin, request }),
      () => serveBrowserClientFolder({ projectFolder, browserClientFolderRelative, request }),
    )

  return startServer({
    cancellationToken,
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    requestToResponse: service,
  })
}
