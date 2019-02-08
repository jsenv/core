import { createOperation } from "@dmail/cancellation"
import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import { fileCopy, fileWrite } from "@dmail/helper"
import { startCompileServer } from "../server-compile/index.js"
import { fetchUsingHttp } from "../platform/node/fetchUsingHttp.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { parseDependencies } from "../parse-dependencies/parseDependencies.js"

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

    const [
      mainCompilationInstruction,
      additionalCompilationInstruction,
      server,
    ] = await Promise.all([
      getMainCompilationInstruction({
        cancellationToken,
        localRoot,
        main,
      }),
      getAdditionalCompilationInstruction({
        cancellationToken,
        localRoot,
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

    // compilationInstruction must also (mostly for main)
    // return a list of mapping in case
    // the file can be found somewhere else
    const compilationInstruction = {
      ...mainCompilationInstruction,
      ...additionalCompilationInstruction,
    }
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
          compilationInstruction,
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

const getMainCompilationInstruction = async ({ cancellationToken, localRoot, main }) => {
  const mainDependencies = await parseDependencies({
    cancellationToken,
    root: localRoot,
    ressource: main,
  })

  const compilationInstruction = {}

  Object.keys(mainDependencies).forEach((ressource) => {
    compilationInstruction[ressource] = "compile"
  })

  return compilationInstruction
}

const getAdditionalCompilationInstruction = async ({
  cancellationToken,
  localRoot,
  compilePatternMapping,
}) => {
  const metaMap = patternGroupToMetaMap({
    compile: compilePatternMapping,
  })

  const compilationInstruction = {}

  await forEachRessourceMatching({
    cancellationToken,
    localRoot,
    metaMap,
    predicate: (meta) => meta.compile,
    callback: (ressource, meta) => {
      compilationInstruction[ressource] = meta.compile
    },
  })

  return compilationInstruction
}

const compileGroup = async ({
  cancellationToken,
  localRoot,
  compileInto,
  compileId,
  remoteRoot,
  compilationInstruction,
}) => {
  await Promise.all(
    Object.keys(compilationInstruction).map(async (ressource) => {
      const compileInstruction = compilationInstruction[ressource]

      if (compileInstruction === "copy") {
        await createOperation({
          cancellationToken,
          start: () =>
            fileCopy(
              `${localRoot}/${ressource}`,
              `${localRoot}/${compileInto}/${compileId}/${ressource}`,
            ),
        })
      }
      if (compileInstruction === "compile") {
        const remoteURL = `${remoteRoot}/${compileInto}/${compileId}/${ressource}`
        await fetchUsingHttp(remoteURL, { cancellationToken })
      }

      throw new Error(`unexpected compileInstruction, got ${compileInstruction}`)
    }),
  )
}

// importCompiledFile is not exported by @dmail/dev-server
// we need that export if we do what is below
const generateNodeMainSource = ({ compileInto, main }) => `
const path = require("path")
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
