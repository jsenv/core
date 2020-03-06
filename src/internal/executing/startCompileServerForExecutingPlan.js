import { startCompileServer } from "../compiling/startCompileServer.js"
import { fetchUrl } from "../fetchUrl.js"

export const startCompileServerForExecutingPlan = async ({
  // false because don't know if user is going
  // to use both node and browser
  browserRuntimeAnticipatedGeneration = false,
  nodeRuntimeAnticipatedGeneration = false,
  ...rest
}) => {
  const compileServer = await startCompileServer(rest)

  const promises = []
  if (browserRuntimeAnticipatedGeneration) {
    promises.push(
      fetchUrl(
        `${compileServer.origin}/${compileServer.outDirectoryRelativeUrl}otherwise-global-bundle/src/browserRuntime.js`,
        { ignoreHttpsError: true },
      ),
    )
  }
  if (nodeRuntimeAnticipatedGeneration) {
    promises.push(
      fetchUrl(
        `${compileServer.origin}/${compileServer.outDirectoryRelativeUrl}otherwise-commonjs-bundle/src/nodeRuntime.js`,
        { ignoreHttpsError: true },
      ),
    )
  }

  await Promise.all(promises)

  return compileServer
}
