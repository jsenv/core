import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { executeFileOnPlatform } from "../../executeFileOnPlatform/executeFileOnPlatform.js"
import { launchNode } from "../../launchNode.js"

const file = `src/launchNode/test/fixtures/close-later.js`
const compileInto = "build"

const exec = async ({ cancellationToken }) => {
  const { origin: remoteRoot } = await startCompileServer({
    cancellationToken,
    localRoot,
    compileInto,
    protocol: "http",
  })

  const verbose = true
  executeFileOnPlatform(
    file,
    () => launchNode({ cancellationToken, localRoot, remoteRoot, compileInto }),
    {
      platformTypeForLog: "node process",
      cancellationToken,
      verbose,
    },
  )
}

exec({})
