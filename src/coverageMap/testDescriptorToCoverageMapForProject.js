import { testDescriptorToCoverageMap } from "./index.js"
import { jsCreateCompileServiceForProject } from "../jsCreateCompileServiceForProject.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { forEachRessourceMatching } from "@dmail/project-structure"

const testDescriptorToInstrumentPredicate = (testDescriptor) => {
  const testFiles = new Set()

  Object.keys(testDescriptor).forEach((name) => {
    testDescriptor[name].files.forEach((file) => {
      testFiles.add(file)
    })
  })

  return (file) => testFiles.has(file) === false
}

export const testDescriptorToCoverageMapForProject = async (
  testDescriptor,
  { cancellation, localRoot, compileInto, watch = false, sourceCacheStrategy, sourceCacheIgnore },
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
    filesToCover,
  })
}
