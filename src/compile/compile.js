import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import { fileCopy, fileWrite } from "@dmail/helper"
import { startCompileServer } from "../server-compile/index.js"
import { fetchUsingHttp } from "../platform/node/fetchUsingHttp.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const compile = async ({
  main = "index.js",
  localRoot,
  compileInto,
  pluginMap = {},
  compileGroupCount = 1,
  pluginCompatMap,
  platformUsageMap,
  compilePatternmapping,
}) =>
  catchAsyncFunctionCancellation(async () => {
    if (typeof localRoot !== "string")
      throw new TypeError(`localRoot must be a string, got ${localRoot}`)
    if (typeof compileInto !== "string")
      throw new TypeError(`compileInto must be a string, got ${compileInto}`)
    if (typeof main !== "string") throw new TypeError(`main must be a string, got ${main}`)

    const cancellationToken = createProcessInterruptionCancellationToken()

    const metaMap = patternGroupToMetaMap({
      compile: compilePatternmapping,
    })

    const [ressourceAndCompileMetaArray, server] = await Promise.all([
      forEachRessourceMatching({
        cancellationToken,
        localRoot,
        metaMap,
        predicate: (meta) => meta.compile,
        callback: (ressource, meta) => {
          return { ressource, compileMeta: meta.compile }
        },
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
      Object.keys(compileMap).map((compileId) => {
        return compileGroup({
          cancellationToken,
          ressourceAndCompileMetaArray,
          remoteRoot,
          localRoot,
          compileInto,
          compileId,
        })
      }),
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
  // cancellationToken,
  ressourceAndCompileMetaArray,
  remoteRoot,
  localRoot,
  compileInto,
  compileId,
}) => {
  await Promise.all(
    ressourceAndCompileMetaArray.map(async ({ ressource, compileMeta }) => {
      if (compileMeta === "copy") {
        await fileCopy(
          `${localRoot}/${ressource}`,
          `${localRoot}/${compileInto}/${compileId}/${ressource}`,
        )
        return
      }

      const remoteURL = `${remoteRoot}/${compileInto}/${compileId}/${ressource}`
      // if fetch using http supported cancellation we could give it cancellationToken
      await fetchUsingHttp(remoteURL)
      return
    }),
  )
}

const generateNodeMainSource = ({ compileInto, main }) => `
const path = require("path")
const { createNodeSystem, compileIdFromCompileMap } = require("@dmail/dev-server")
const compileMap = require("./compileMap.json")

const compileId = compileIdFromCompileMap(compileMap)
const compileFolder = __dirname
const rootDirname = compileFolder.slice(0, -"${compileInto}".length - 1)
const nodeSystem = createNodeSystem({
  localRoot: \`file://\${rootDirname}\`,
  remoteRoot: \`file://\${compileFolder}/\`,
})
module.exports = nodeSystem.import(\`./\${compileId}/${main}\`)`

const generateBrowserMainSource = ({ globalName }) => {
  /*
  celui la je sais pas encore
  je vais avoir besoin de rollup pour inline
  browserSystem
  mais une fois que je l'ai je pourrais trés bien l'utiliser directement
  dans un html genre

  <script src="@jsenv/dist/browserSystem.js"></script>
  <script>
    window.System.import('')
  </script>

  en fait non parce que chaque projet pourrait spécifier des
  compile profile différent
  mais en fait c'est bete, c'est le projet principal qui compile toutes
  ses dépendances donc c'est lui qui choisit
  autrement dit on ne fait pas de dist pour le browser

  si on veut l'utiliser dans un browser
  on est obligé du'utiliser jsenv
  mais c'est ce que je veux éviter justement
  pouvoir générer un dist qui ne dépend pas de jsenv

  pour cela il faudrait donc avoir un window[`${moduleName}Promise`]
  lorsqu'on utilise une balise script

  ce script contiendrais donc browserSystem +
  le import nécéssaire et ne surchargerais pas window

  on aurait donc bien besoin de compileMap je dirais
  */
  return ``
}
