import { getCoverageMapAndOutputMapForFiles } from "./getCoverageMapAndOutputMapForFiles.js"
import { getCoverageMapForFilesMissed, getFilesMissed } from "./getCoverageMapForFilesMissed.js"
import { coverageMapAbsolute } from "./coverageMapAbsolute.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { promiseTry, promiseSequence } from "./promiseHelper.js"

export const getCoverageAndOutputForClients = ({
  root,
  into,
  instrumentPredicate,
  getFilesToCover = () => [],
  clients = [],
}) => {
  return openCompileServer({
    root,
    into,
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    instrument: true,
    instrumentPredicate,
  }).then((server) => {
    const localRoot = root
    const remoteRoot = server.origin
    const remoteCompileDestination = into

    const getCoverageMapAndOutputMapForClient = ({ getExecute, getFiles }) => {
      return Promise.all([
        promiseTry(() => getExecute({ localRoot, remoteRoot, remoteCompileDestination })),
        promiseTry(getFiles),
      ]).then(([execute, files]) => {
        return getCoverageMapAndOutputMapForFiles({
          localRoot,
          remoteRoot,
          remoteCompileDestination,
          execute,
          files,
        })
      })
    }

    // compose all coverageMaps into one
    // and check if all files supposed to be covered where actually covered
    // if not add empty coverage for thoose files and return
    // a coverageMap with all this
    const getFinalCoverageMap = (coverageMaps) => {
      const coverageMapComposed = coverageMapCompose(...coverageMaps)

      return promiseTry(getFilesToCover)
        .then((filesToCover) => {
          return {
            ...coverageMapComposed,
            ...getCoverageMapForFilesMissed(
              getFilesMissed(coverageMapComposed, filesToCover),
              server.compileFile,
            ),
          }
        })
        .then((coverageMap) => coverageMapAbsolute(coverageMap, root))
    }

    return promiseSequence(...clients.map((client) => getCoverageMapAndOutputMapForClient(client)))
      .then((results) => {
        const outputs = results.map(({ outputMap }) => outputMap)
        const coverageMaps = results.map(({ coverageMap }) => coverageMap)
        return {
          outputs,
          coverageMaps,
        }
      })
      .then(({ outputs, coverageMaps }) => {
        return getFinalCoverageMap(coverageMaps).then((coverageMap) => {
          return {
            outputs,
            coverageMaps,
            coverageMap,
          }
        })
      })
  })
}
