import path from "path"
import { createExecuteOnNode } from "../createExecuteOnNode/createExecuteOnNode.js"
import { testDescriptorToCoverageMap } from "./index.js"
import { jsCreateCompileServiceForProject } from "../jsCreateCompileServiceForProject.js"
import { createCancel } from "../cancel/index.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { forEachRessourceMatching } from "@dmail/project-structure"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "dist"
const watch = false

const testDescriptorToInstrumentPredicate = (testDescriptor) => {
  const testFiles = new Set()

  Object.keys(testDescriptor).forEach((name) => {
    testDescriptor[name].files.forEach((file) => {
      testFiles.add(file)
    })
  })

  return (file) => testFiles.has(file) === false
}

const testDescriptorToCoverageMapForProject = async (
  testDescriptor,
  { cancellation, sourceCacheStrategy, sourceCacheIgnore },
) => {
  const instrumentPredicate = testDescriptorToInstrumentPredicate(testDescriptor)

  const {
    compileService,
    watchPredicate,
    groupMapFile,
    projectMetaMap,
  } = await jsCreateCompileServiceForProject({
    cancellation,
    localRoot,
    compileInto,
    instrumentPredicate,
  })

  const [server, filesToCover] = await Promise.all([
    serverCompileOpen({
      cancellation,
      protocol: "http",
      ip: "127.0.0.1",
      port: 0,
      localRoot,
      compileInto,
      compileService,
      watch,
      watchPredicate,
      sourceCacheStrategy,
      sourceCacheIgnore,
    }),
    forEachRessourceMatching(
      localRoot,
      projectMetaMap,
      ({ cover }) => cover,
      ({ relativeName }) => relativeName,
    ),
  ])

  return testDescriptorToCoverageMap(testDescriptor, {
    cancellation,
    localRoot,
    compileInto,
    remoteRoot: server.origin,
    groupMapFile,
    watch,
    filesToCover: ["index.js"], // for now, to avoid too many coverage
  })
}

const testDescriptor = {
  node: {
    createExecute: createExecuteOnNode,
    files: ["src/__test__/file.test.js"],
  },
  chrome: {
    createExecute: () => {},
    files: [], // ["src/__test__/file.test.js"]
  },
}
const { cancellation } = createCancel()
testDescriptorToCoverageMapForProject(testDescriptor, { cancellation }).then((coverageMap) => {
  debugger
})
