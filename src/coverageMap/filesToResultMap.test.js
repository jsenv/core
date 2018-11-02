import path from "path"
import { createExecuteOnNode } from "../createExecuteOnNode/createExecuteOnNode.js"
import { filesToResultMap } from "./filesToResultMap.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { jsCreateCompileServiceForProject } from "../jsCreateCompileServiceForProject.js"
import assert from "assert"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const files = ["src/__test__/file.test.js"]

const test = async () => {
  const { compileService, groupMapFile } = await jsCreateCompileServiceForProject({
    localRoot,
    compileInto,
  })

  const { origin: remoteRoot } = await serverCompileOpen({
    localRoot,
    compileInto,
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    compileService,
    cacheDisabled: true,
  })

  const execute = createExecuteOnNode({
    localRoot,
    remoteRoot,
    compileInto,
    groupMapFile,
  })

  return filesToResultMap(files, execute)
}

test().then((resultMap) => {
  const firstFile = files[0]
  assert.equal(firstFile in resultMap, true)
  const fileResult = resultMap[firstFile]
  assert.equal(fileResult.output, undefined)
  assert.deepEqual(Object.keys(fileResult.coverageMap).sort(), [
    "src/__test__/file.js",
    "src/__test__/file.test.js",
  ])
  console.log("passed")
})
