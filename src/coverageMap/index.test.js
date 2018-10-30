import path from "path"
import { createExecuteOnNode } from "../createExecuteOnNode/createExecuteOnNode.js"
import { getCoverageAndOutputForClients } from "./index.js"
import { createJSCompileServiceForProject } from "../createJSCompileServiceForProject.js"
import { createCancel } from "../cancel/index.js"
import { open as serverCompileOpen } from "../server-compile/index.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "dist"
const watch = false

const exec = async ({ cancellation, sourceCacheStrategy, sourceCacheIgnore }) => {
  const {
    compileService,
    watchPredicate,
    groupMapFile,
    // groupMap, // groupMap can be usefull in case we want to execute on chromium client
    // because unlike nodejs the groupeMap file is not fetched but inlined in the browser page
    // we could fetch it to avoid this difference
  } = await createJSCompileServiceForProject({
    cancellation,
    localRoot,
    compileInto,
  })

  const { origin: remoteRoot } = await serverCompileOpen({
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    cancellation,
    localRoot,
    compileInto,
    compileService,
    watch,
    watchPredicate,
    sourceCacheStrategy,
    sourceCacheIgnore,
  })

  return getCoverageAndOutputForClients({
    // we are missing the compileFile
    // function which could be retrived from createJSCompileServiceForProject
    cancellation,
    // filesToCover will come from fileStructure because to painful to maintain
    filesToCover: ["src/__test__/file.js", "src/__test__/file2.js"],
    // forEachFileMatching(coverMetaPredicate, ({ relativeName }) => relativeName),
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
