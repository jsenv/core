/* eslint-disable import/max-dependencies */
import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { uneval } from "@dmail/uneval"
import { fileWrite, fileRead } from "@dmail/helper"
import { ROOT_FOLDER } from "../ROOT_FOLDER.js"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import { startServer, serviceCompose } from "../server/index.js"
import { generateGroupMap } from "../group-map/index.js"
import { createCompileService } from "./compile-service/createCompileService.js"
import { compileJs } from "./compile-js/index.js"
import { compileImportMap } from "./compile-import-map/index.js"
import { compileFile } from "./compile-file/index.js"
import {
  COMPILE_SERVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  COMPILE_SERVER_DEFAULT_COMPILE_INTO,
  COMPILE_SERVER_DEFAULT_BABEL_CONFIG_MAP,
  COMPILE_SERVER_DEFAULT_BABEL_COMPAT_MAP,
  COMPILE_SERVER_DEFAULT_BROWSER_SCORE_MAP,
  COMPILE_SERVER_DEFAULT_NODE_VERSION_SCORE_MAP,
} from "./compile-server-constant.js"
import { bundleBrowser } from "../bundle/browser/bundleBrowser.js"

export const startCompileServer = async ({
  projectFolder,
  cancellationToken = createCancellationToken(),
  importMapFilenameRelative = COMPILE_SERVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  compileInto = COMPILE_SERVER_DEFAULT_COMPILE_INTO,
  // option related to compile groups
  compileGroupCount = 1,
  babelConfigMap = COMPILE_SERVER_DEFAULT_BABEL_CONFIG_MAP,
  babelCompatMap = COMPILE_SERVER_DEFAULT_BABEL_COMPAT_MAP,
  browserScoreMap = COMPILE_SERVER_DEFAULT_BROWSER_SCORE_MAP,
  nodeVersionScoreMap = COMPILE_SERVER_DEFAULT_NODE_VERSION_SCORE_MAP,
  // options related to how cache/hotreloading
  watchSource = false,
  watchSourcePredicate = () => true,
  // js compile options
  transformTopLevelAwait,
  // options related to the server itself
  cors = true,
  protocol,
  ip,
  port,
  signature,
  verbose,
}) => {
  if (typeof projectFolder !== "string")
    throw new TypeError(`projectFolder must be a string. got ${projectFolder}`)

  projectFolder = normalizePathname(projectFolder)

  const groupMap = generateGroupMap({
    babelConfigMap,
    babelCompatMap,
    platformScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: compileGroupCount,
  })

  await Promise.all([
    fileWrite(
      `${projectFolder}/${compileInto}/groupMap.json`,
      JSON.stringify(groupMap, null, "  "),
    ),
  ])

  const compileService = await createCompileService({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    watchSource,
    watchSourcePredicate,
    groupMap,
    compileBrowserClient: ({ headers, compileId }) => {
      const browserClientFilenameJsenvRelative = "src/platform/browser/browserPlatform.js"
      const browserBalancerFilenameJsenvRelative =
        "src/browser-compile-id/computeBrowserCompileId.js"
      const insideJsenv = projectFolder.startsWith(`${ROOT_FOLDER}/`)

      const browserClientFilename = insideJsenv
        ? `${ROOT_FOLDER}/${compileInto}/${browserClientFilenameJsenvRelative}`
        : `${projectFolder}/${compileInto}/${browserClientFilenameJsenvRelative}`
      const browserClientCompiledFilenameRelative = insideJsenv
        ? `${compileInto}/${browserClientFilenameJsenvRelative}`
        : `${compileInto}/node_module/@jsenv/core/${browserClientFilenameJsenvRelative}`
      const browserClientCompiledFilename = `${projectFolder}/${browserClientCompiledFilenameRelative}`

      debugger
      // oui en fait compileFile aurait besoin d'un coup de pouce ici
      // parce que l'endroit ou se trouve le fichier n'est pas celui
      // ou on le met

      // const browserBalancerFilenameRelative = insideJsenv
      //   ? browserBalancerFilenameJsenvRelative
      //   : `node_module/@jsenv/core/${browserBalancerFilenameJsenvRelative}`
      const browserBalancerFilename = insideJsenv
        ? `${ROOT_FOLDER}/${browserBalancerFilenameJsenvRelative}`
        : `${projectFolder}/${browserBalancerFilenameJsenvRelative}`

      return compileFile({
        projectFolder,
        compileInto,
        headers,
        compileId,
        filenameRelative: browserClientCompiledFilenameRelative,
        filename: browserClientCompiledFilename,
        compile: async () => {
          const bundle = await bundleBrowser({
            // the projectFolder is the root folder
            // except if you pass a custom one, but we'll see that later ?
            projectFolder: insideJsenv ? ROOT_FOLDER : projectFolder,
            inlineSpecifierMap: {
              ["JSENV_BROWSER_CLIENT.js"]: browserClientFilename,
              ["COMPUTE_BROWSER_COMPILE_ID"]: browserBalancerFilename,
              ["PLATFORM_META"]: () => `export const groupMap = ${uneval(groupMap)}`,
            },
            entryPointMap: {
              main: "JSENV_BROWSER_CLIENT.js",
            },
            babelConfigMap,
            minify: false,
            throwUnhandled: false,
            compileGroupCount: 1,
          })
          const main = bundle.output[0]
          return {
            compiledSource: main.code,
            sources: main.map.sources,
            sourcesContent: main.map.sourcesContent,
            assets: ["main.map.js"],
            assetsSource: [JSON.stringify(main.map)],
            compiledSourceFileWritten: true, // already written by rollup
            assetsFileWritten: true, // already written by
          }
        },
        // for now disable cache for client because veryfing
        // it would mean ensuring the whole bundle is still valid
        // I suspect it is faster to regenerate the bundle than check
        // if it's still valid.
        clientCompileCacheStrategy: "none",
      })
    },
    compileImportMap: ({ headers, compileId, filenameRelative, filename }) => {
      filenameRelative = `${compileInto}/${compileId}/${filenameRelative}`
      filename = `${projectFolder}/${filenameRelative}`

      return compileFile({
        projectFolder,
        headers,
        filenameRelative,
        filename,
        compile: async ({ filename }) => {
          const source = await fileRead(filename)
          return compileImportMap({
            compileInto,
            compileId,
            source,
          })
        },
      })
    },
    compileJs: ({ origin, headers, compileId, filenameRelative, filename }) => {
      filenameRelative = `${compileInto}/${compileId}/${filenameRelative}`
      filename = `${projectFolder}/${filenameRelative}`

      return compileFile({
        projectFolder,
        compileInto,
        headers,
        compileId,
        filenameRelative,
        filename,
        compile: async ({ filename }) => {
          const source = await fileRead(filename)
          const groupBabelConfigMap = {}
          groupMap[compileId].incompatibleNameArray.forEach((incompatibleFeatureName) => {
            if (incompatibleFeatureName in babelConfigMap) {
              groupBabelConfigMap[incompatibleFeatureName] = babelConfigMap[incompatibleFeatureName]
            }
          })

          return compileJs({
            projectFolder,
            compileInto,
            compileId,
            filenameRelative,
            filename,
            source,
            babelConfigMap: groupBabelConfigMap,
            transformTopLevelAwait,
            origin,
          })
        },
      })
    },
  })

  const compileOrServeFileService = serviceCompose(compileService, (request) =>
    requestToFileResponse(request, {
      projectFolder,
      locate: locateFileSystem,
    }),
  )

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    requestToResponse: compileOrServeFileService,
    verbose,
    cors,
    startedMessage: ({ origin }) => `compile server started for ${projectFolder} at ${origin}`,
    stoppedMessage: (reason) => `compile server stopped because ${reason}`,
  })
  // https://nodejs.org/api/net.html#net_server_unref
  // but while debugging it may close the server too soon, to be tested
  compileServer.nodeServer.unref()

  return compileServer
}

// this file be removed once we have the dynamic bundling
const locateFileSystem = ({ rootHref, filenameRelative }) => {
  // consumer of @jsenv/core use
  // 'node_modules/@jsenv/core/dist/browserSystemImporter.js'
  // to get file.
  // in order to test this behaviour while developping @jsenv/core
  // 'node_modules/@jsenv/core` is an alias to rootHref
  if (filenameRelative.startsWith("node_modules/@jsenv/core")) {
    const sourceOrigin = `file://${ROOT_FOLDER}`
    if (rootHref === sourceOrigin || rootHref.startsWith(`${sourceOrigin}/`)) {
      const filenameRelativeSelf = filenameRelative.slice("node_modules/@jsenv/core/".length)
      return `${sourceOrigin}/${filenameRelativeSelf}`
    }
  }

  return `${rootHref}/${filenameRelative}`
}
