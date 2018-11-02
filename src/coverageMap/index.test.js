import path from "path"
import { createExecuteOnNode } from "../createExecuteOnNode/createExecuteOnNode.js"
import { getCoverageAndOutputForClients } from "./index.js"
import { jsCreateCompileServiceForProject } from "../jsCreateCompileServiceForProject.js"
import { createCancel } from "../cancel/index.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { forEachRessourceMatching } from "@dmail/project-structure"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "dist"
const watch = false

const exec = async ({ cancellation, sourceCacheStrategy, sourceCacheIgnore }) => {
  const {
    compileService,
    watchPredicate,
    groupMapFile,
    projectMetaMap,
  } = await jsCreateCompileServiceForProject({
    cancellation,
    localRoot,
    compileInto,
  })

  const { origin: remoteRoot } = await serverCompileOpen({
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
  })

  // filesToCover will come from projectMetaMap because to painful to maintain
  // and I think we can assume the default behaviour is that every file should be covered except test files
  // const filesToCover = ["src/__test__/file.js", "src/__test__/file2.js"]
  const filesToCover = await forEachRessourceMatching(
    localRoot,
    projectMetaMap,
    ({ cover }) => cover,
    ({ relativeName }) => relativeName,
  )

  return getCoverageAndOutputForClients({
    cancellation,
    localRoot,
    filesToCover,
    clients: [
      {
        execute: createExecuteOnNode({
          localRoot,
          remoteRoot,
          compileInto,
          groupMapFile,
          hotreload: watch,
          hotreloadSSERoot: remoteRoot,
        }),
        // ces fichier ne devront pas etre instrument
        // cela doit modifier le instrument predicate
        files: ["src/__test__/file.test.js"],
      },
      // {
      //   execute: createExecuteOnChromium({}),
      //   files: ["src/__test__/file.test.js"]
      // },
    ],
  })
}

const { cancellation } = createCancel()
exec({ cancellation })
