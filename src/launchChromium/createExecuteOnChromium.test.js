// also have ot write a test for cancel
// to ensure it cancels what's hapenning and resolve when its done

import path from "path"
import { open } from "../server-compile/index.js"
import { createExecuteOnChromium } from "./createExecuteOnChromium.js"
import { jsCreateCompileServiceForProject } from "../jsCreateCompileServiceForProject.js"
import { createCancel } from "../cancel/index.js"

// System.import('http://127.0.0.1:9656/compiled/src/__test__/file.js')

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = true

const test = async ({ cancellation }) => {
  // lorsque le browser demande build/compileId/browserPlatform.js
  // on copie 'sil n'existe pas dist/browserPlatform.js
  // lorsqu'il demnde build/compileId/browserImporter.js
  // on copier dist/browserNativeImporter.js ou dist/browserSystemImporter.js
  // on doit donc modifier compile pour qu'il retourne ce qu'on trouve dans dist
  // et ajouter la possibilité que le fichier localAbsolute se trouve ailleurs
  // que ou on le requete

  const {
    compileService,
    watchPredicate,
    groupMapFile,
    groupMap,
  } = await jsCreateCompileServiceForProject({
    cancellation,
    localRoot,
    compileInto,
  })

  const server = await open({
    cancellation,
    localRoot,
    compileInto,
    compileService,
    watch,
    watchPredicate,
    protocol: "http",
    ip: "127.0.0.1",
  })

  const execute = createExecuteOnChromium({
    cancellation,
    localRoot,
    compileInto,
    remoteRoot: server.origin,
    groupMapFile,
    groupMap,
    headless: false,
  })

  const result = await execute({
    cancellation,
    file: `src/__test__/file.test.js`,
  })

  return result
}

const { cancellation, cancel } = createCancel()
test({ cancellation }).then(
  (value) => {
    cancel("execution done")
    console.log("execution done with", value)
  },
  (reason) => {
    cancel("execution done")
    console.error("execution error", reason)
  },
)
