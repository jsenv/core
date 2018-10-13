import { getCoverageMapAndOutputMapForFiles } from "./getCoverageMapAndOutputMapForFiles.js"
import { getCoverageMapForFilesMissed, getFilesMissed } from "./getCoverageMapForFilesMissed.js"
import { coverageMapAbsolute } from "./coverageMapAbsolute.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { promiseTry, promiseSequence } from "./promiseHelper.js"

export const getCoverageMapFor = ({
  root,
  into,
  instrumentPredicate,
  getFilesToCover = () => [],
  clients = [],
}) => {
  return openCompileServer({
    root,
    into,
    url: "http://127.0.0.1:0",
    instrument: true,
    instrumentPredicate,
  }).then((server) => {
    const localRoot = root
    const remoteRoot = server.url.toString().slice(0, -1)
    const remoteCompileDestination = into

    const getCoverageMapForClient = ({ getExecute, getFiles }) => {
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

    return promiseSequence(...clients.map((client) => getCoverageMapForClient(client)))
      .then((coverageMaps) => coverageMapCompose(...coverageMaps))
      .then((coverageMap) => {
        return promiseTry(getFilesToCover).then((filesToCover) => {
          return {
            ...coverageMap,
            ...getCoverageMapForFilesMissed(
              getFilesMissed(coverageMap, filesToCover),
              server.compileFile,
            ),
          }
        })
      })
      .then((coverageMap) => coverageMapAbsolute(coverageMap, root))
    // now I have the coverageMap for src/__test__/file.test.js
    // on both nodejs and chrome, with eventually
    // some missing coverage for source files
  })
}
