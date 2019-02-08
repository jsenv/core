import { createOperation } from "@dmail/cancellation"
import { fileCopy, fileWrite } from "@dmail/helper"
import { startCompileServer } from "../server-compile/index.js"
import { fetchUsingHttp } from "../platform/node/fetchUsingHttp.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { computeCompilationInstruction } from "./computeCompileInstruction.js"

export const compile = async ({
  localRoot,
  compileInto,
  pluginMap = {},
  compileGroupCount = 1,
  pluginCompatMap,
  platformUsageMap,
  main = "index.js",
  compilePatternMapping = {},
}) =>
  catchAsyncFunctionCancellation(async () => {
    if (typeof localRoot !== "string")
      throw new TypeError(`localRoot must be a string, got ${localRoot}`)
    if (typeof compileInto !== "string")
      throw new TypeError(`compileInto must be a string, got ${compileInto}`)
    if (typeof main !== "string") throw new TypeError(`main must be a string, got ${main}`)

    const cancellationToken = createProcessInterruptionCancellationToken()

    const [compilationInstruction, server] = await Promise.all([
      computeCompilationInstruction({
        cancellationToken,
        localRoot,
        main,
        compilePatternMapping,
      }),
      startCompileServer({
        localRoot,
        compileInto,
        compileGroupCount,
        pluginMap,
        pluginCompatMap,
        platformUsageMap,
      }),
    ])

    const remoteRoot = server.origin
    const compileMapResponse = await fetchUsingHttp(`${remoteRoot}/${compileInto}/compileMap.json`)
    const compileMap = JSON.parse(compileMapResponse.body)

    await Promise.all(
      Object.keys(compileMap).map((compileId) =>
        compileGroup({
          cancellationToken,
          localRoot,
          compileInto,
          compileId,
          remoteRoot,
          ressourceMap: compilationInstruction.ressources,
        }),
      ),
    )

    server.stop()

    await fileWrite(
      `${localRoot}/${compileInto}/node-main.js`,
      generateNodeMainSource({
        compileInto,
        main,
      }),
    )
  })

const compileGroup = async ({
  cancellationToken,
  localRoot,
  compileInto,
  compileId,
  remoteRoot,
  ressourceMap,
}) => {
  await Promise.all(
    Object.keys(ressourceMap).map(async (ressource) => {
      const compileData = ressourceMap[ressource]

      if (compileData.type === "copy") {
        await createOperation({
          cancellationToken,
          start: () =>
            fileCopy(
              `${localRoot}/${ressource}`,
              `${localRoot}/${compileInto}/${compileId}/${ressource}`,
            ),
        })
      }
      if (compileData.type === "compile") {
        const remoteURL = `${remoteRoot}/${compileInto}/${compileId}/${ressource}`
        await fetchUsingHttp(remoteURL, { cancellationToken })
      }

      throw new Error(`unexpected compileData.type, got ${compileData.type}`)
    }),
  )
}

// importCompiledFile is not exported by @dmail/dev-server
// we need that export if we do what is below
const generateNodeMainSource = ({ compileInto, main }) => `
const { importCompiledFile } = require("@dmail/dev-server")

const compileFolder = __dirname
const rootDirname = compileFolder.slice(0, -"${compileInto}".length - 1)
const namespacePromise = importCompiledFile({
  localRoot: \`file://\${rootDirname}\`,
  remoteRoot: \`file://\${compileFolder}/\`,
  compileInto: "${compileInto}",
  file: "${main}"
})
module.exports = namespacePromise`

// we'll do browser compiled file later
// const generateBrowserMainSource = ({ globalName }) => {
//   return ``
// }
