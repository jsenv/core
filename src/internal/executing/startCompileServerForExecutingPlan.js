import { startCompileServer } from "internal/compiling/startCompileServer.js"

const fetch = import.meta.require("node-fetch")

export const startCompileServerForExecutingPlan = async ({
  // false because don't know if user is going
  // to use both node and browser
  browserPlatformAnticipatedGeneration = false,
  nodePlatformAnticipatedGeneration = false,
  ...rest
}) => {
  const compileServer = await startCompileServer(rest)

  const promises = []
  if (browserPlatformAnticipatedGeneration) {
    promises.push(
      fetch(
        `${compileServer.origin}/${compileServer.outDirectoryRelativeUrl}otherwise-global-bundle/src/browserPlatform.js`,
      ),
    )
  }
  if (nodePlatformAnticipatedGeneration) {
    promises.push(
      fetch(
        `${compileServer.origin}/${compileServer.outDirectoryRelativeUrl}otherwise-commonjs-bundle/src/nodePlatform.js`,
      ),
    )
  }

  await Promise.all(promises)

  return compileServer
}
