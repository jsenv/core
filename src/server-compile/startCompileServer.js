/* eslint-disable import/max-dependencies */
import { normalizePathname, hrefToPathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import { startServer, serviceCompose } from "../server/index.js"
import { generateGroupMap } from "../group-map/index.js"
import { createCompileService } from "./compile-service/createCompileService.js"
import { compileJs } from "./compile-js/index.js"
import {
  COMPILE_SERVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  COMPILE_SERVER_DEFAULT_COMPILE_INTO,
  COMPILE_SERVER_DEFAULT_BABEL_CONFIG_MAP,
  COMPILE_SERVER_DEFAULT_BABEL_COMPAT_MAP,
  COMPILE_SERVER_DEFAULT_BROWSER_SCORE_MAP,
  COMPILE_SERVER_DEFAULT_NODE_VERSION_SCORE_MAP,
} from "./compile-server-constant.js"
import { compileBrowserClient } from "./compile-browser-client/compileBrowserClient.js"

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

  const compileBrowserClientService = ({ headers, ressource }) => {
    if (ressource !== `/${compileInto}/JSENV_BROWSER_CLIENT.js`) return null
    return compileBrowserClient({
      projectFolder,
      importMapFilenameRelative,
      compileInto,
      babelConfigMap,
      groupMap,
      transformTopLevelAwait,
      headers,
    })
  }

  const compileNodeClientService = ({ ressource }) => {
    if (ressource !== `/${compileInto}/JSENV_NODE_CLIENT.js`) return null
    return null // TODO
  }

  const compileService = await createCompileService({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    watchSource,
    watchSourcePredicate,
    groupMap,
    // todo: pass { projectFolder, compileInto, groupMap, babelConfigMap, transformTopLevelAwait}
    // to compileJS
    compileJs,
  })

  const compileOrServeFileService = serviceCompose(
    compileBrowserClientService,
    compileNodeClientService,
    compileService,
    (request) =>
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
  return `file://${resolveProjectFilename({
    projctFolder: hrefToPathname(rootHref),
    filenameRelative,
  })}`
}
