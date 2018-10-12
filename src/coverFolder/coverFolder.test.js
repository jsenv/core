import {
  getCoverageMapAndOutputMapForFiles,
  getCoverageMapMissed,
  absolutizeCoverageMap,
  composeCoverageMap,
} from "./coverFolder.js"
import { createFileStructure } from "@dmail/project-structure"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import path from "path"
import { openNodeClient } from "../openNodeClient/openNodeClient.js"

const root = path.resolve(__dirname, "../../../")
const into = "dist"

createFileStructure({ root }).then(({ forEachFileMatching, getMetaForLocation }) => {
  return openCompileServer({
    root,
    into,
    url: "http://127.0.0.1:0",
    instrument: true,
    instrumentPredicate: (file) => getMetaForLocation(file).instrument,
  }).then((server) => {
    const localRoot = root
    const remoteRoot = server.url.toString().slice(0, -1)
    const remoteCompileDestination = into

    return Promise.all([
      getCoverageMapAndOutputMapForFiles({
        localRoot,
        remoteRoot,
        remoteCompileDestination,
        createClient: openNodeClient,
        files: ["src/__test__/file.test.js"],
      }),
      getCoverageMapAndOutputMapForFiles({
        localRoot,
        remoteRoot,
        remoteCompileDestination,
        createClient: openNodeClient, // here we could pass openChromiumClient
        files: ["src/__test__/file.test.js"], // here we could change the array
      }),
    ])
      .then((coverageMaps) => composeCoverageMap(...coverageMaps))
      .then((coverageMap) => {
        return forEachFileMatching(({ cover }) => cover, ({ relativeName }) => relativeName).then(
          (filesToCover) => {
            return {
              ...coverageMap,
              ...getCoverageMapMissed(coverageMap, filesToCover, server.compileFile),
            }
          },
        )
      })
      .then((coverageMap) => absolutizeCoverageMap(coverageMap, root))
      .then(() => {
        // now I have the coverageMap for src/__test__/file.test.js
        // on both nodejs and chrome, with eventually
        // some missing coverage for source files
      })
  })
})
