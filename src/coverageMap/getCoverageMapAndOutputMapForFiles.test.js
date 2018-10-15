import path from "path"
import { createExecuteOnNode } from "../createExecuteOnNode/createExecuteOnNode.js"
import { getCoverageMapAndOutputMapForFiles } from "./getCoverageMapAndOutputMapForFiles.js"
import { openCompileServer } from "../openCompileServer/index.js"

const root = path.resolve(__dirname, "../../../")
const into = "build"
const files = ["src/__test__/file.test.js"]

openCompileServer({
  root,
  into,
  protocol: "http",
  ip: "127.0.0.1",
  port: 0,
  instrument: true,
  instrumentPredicate: (file) => files.indexOf(file) === -1,
  cacheDisabled: true,
}).then((server) => {
  const { execute } = createExecuteOnNode({
    localRoot: root,
    remoteRoot: server.origin,
    remoteCompileDestination: into,
  })

  return getCoverageMapAndOutputMapForFiles({
    execute,
    files,
  }).then(({ coverageMap, outputMap }) => {
    debugger
  })
})
