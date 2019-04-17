/* eslint-disable import/max-dependencies */
import { normalizePathname, hrefToPathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { resolveProjectFilename } from "../resolveProjectFilename.js"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import { acceptContentType, createSSERoom, startServer, serviceCompose } from "../server/index.js"
import { watchFile } from "../watchFile.js"
import { generateGroupMap } from "../group-map/index.js"
import {
  COMPILE_SERVER_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  COMPILE_SERVER_DEFAULT_COMPILE_INTO,
  COMPILE_SERVER_DEFAULT_BABEL_CONFIG_MAP,
  COMPILE_SERVER_DEFAULT_BABEL_COMPAT_MAP,
  COMPILE_SERVER_DEFAULT_BROWSER_SCORE_MAP,
  COMPILE_SERVER_DEFAULT_NODE_VERSION_SCORE_MAP,
} from "./compile-server-constant.js"
import { serveBrowserClient } from "./serve-browser-client/index.js"
import { serveCompiledJs } from "./serve-compiled-js/index.js"

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

  // this callback will be called each time a projectFile was
  // used to respond to a request
  // it is not used yet but is meant to implement hotreloading
  // each time a client will need a project file we will watch that file
  // and a client can register to these events to reload the page
  // when a project file changed
  let projectFileRequestedCallback = () => {}

  const services = []

  if (watchSource) {
    const { registerFileChangedCallback, triggerFileChanged } = createFileChangedSignal()

    const watchedFiles = new Map()
    cancellationToken.register(() => {
      watchedFiles.forEach((closeWatcher) => closeWatcher())
      watchedFiles.clear()
    })
    projectFileRequestedCallback = ({ filenameRelative, filename }) => {
      // when I ask for a compiled file, watch the corresponding file on filesystem
      // here we should use the registerFileLifecyle stuff made in
      // jsenv-eslint-import-resolver so support if file gets created/deleted
      // by the way this is not truly working if compile creates a bundle
      // in that case we should watch for the whole bundle
      // sources, for now let's ignore
      if (watchedFiles.has(filename) === false && watchSourcePredicate(filenameRelative)) {
        const fileWatcher = watchFile(filename, () => {
          triggerFileChanged({ filename, filenameRelative })
        })
        watchedFiles.set(filename, fileWatcher)
      }
    }

    const fileChangedSSE = createSSERoom()

    fileChangedSSE.open()
    cancellationToken.register(fileChangedSSE.close)

    registerFileChangedCallback(({ filenameRelative }) => {
      fileChangedSSE.sendEvent({
        type: "file-changed",
        data: filenameRelative,
      })
    })

    const watchSSEService = ({ headers }) => {
      if (acceptContentType(headers.accept, "text/event-stream")) {
        return fileChangedSSE.connect(headers["last-event-id"])
      }
      return null
    }

    services.push(watchSSEService)
  }

  const browserClientService = ({ headers, ressource }) => {
    if (ressource !== `/${compileInto}/JSENV_BROWSER_CLIENT.js`) return null
    return serveBrowserClient({
      projectFolder,
      importMapFilenameRelative,
      compileInto,
      babelConfigMap,
      groupMap,
      transformTopLevelAwait, // TODO: do sthing with this
      projectFileRequestedCallback, // TODO: do sthing with this
      headers,
    })
  }
  services.push(browserClientService)

  const nodeClientService = ({ ressource }) => {
    if (ressource !== `/${compileInto}/JSENV_NODE_CLIENT.js`) return null
    return null // TODO
  }
  services.push(nodeClientService)

  const projectFileService = ({ headers, ressource }) => {
    const { compileId, filenameRelative } = locateProject({
      compileInto,
      ressource,
    })

    // cannot locate a file -> we don't know what to compile
    // -> will be handled by requestToFileResponse
    if (!compileId) return null

    // unexpected compileId
    if (compileId in groupMap === false) return { status: 400, statusText: "unknown compileId" }

    // it's an asset, it will be served by requestToFileResponse
    if (filenameRelativeIsAsset(filenameRelative)) return null

    // .json does not need to be compiled, they are redirected
    // to the source location
    if (filenameRelative.endsWith(".json"))
      return {
        status: 307,
        headers: {
          location: `${origin}/${filenameRelative}`,
        },
      }

    return serveCompiledJs({
      projectFolder,
      compileInto,
      groupMap,
      babelConfigMap,
      transformTopLevelAwait,
      projectFileRequestedCallback, // TODO: do something with this
      origin,
      headers,
      compileId,
      filenameRelative,
    })
  }
  services.push(projectFileService)

  const fileService = (request) =>
    requestToFileResponse(request, {
      projectFolder,
      locate: locateFileSystem,
    })
  services.push(fileService)

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    requestToResponse: serviceCompose(...services),
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

const createFileChangedSignal = () => {
  const fileChangedCallbackArray = []

  const registerFileChangedCallback = (callback) => {
    fileChangedCallbackArray.push(callback)
  }

  const changed = (data) => {
    const callbackArray = fileChangedCallbackArray.slice()
    callbackArray.forEach((callback) => {
      callback(data)
    })
  }

  return { registerFileChangedCallback, changed }
}

// this locateFileSystem concept can be removed once we have the
// dynamic bundling no ?
const locateFileSystem = ({ rootHref, filenameRelative }) => {
  // consumer of @jsenv/core use
  // 'node_modules/@jsenv/core/dist/browserSystemImporter.js'
  // to get file.
  // in order to test this behaviour while developping @jsenv/core
  // 'node_modules/@jsenv/core` is an alias to rootHref
  return `file://${resolveProjectFilename({
    projectFolder: hrefToPathname(rootHref),
    filenameRelative,
  })}`
}

const locateProject = ({ compileInto, ressource }) => {
  if (ressource.startsWith(`/${compileInto}/`) === false) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const afterCompileInto = ressource.slice(`/${compileInto}/`.length)
  const parts = afterCompileInto.split("/")

  const compileId = parts[0]
  if (compileId.length === 0) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const filenameRelative = parts.slice(1).join("/")
  if (filenameRelative.length === 0) {
    return {
      compileId: null,
      filenameRelative: "",
    }
  }

  return {
    compileId,
    filenameRelative,
  }
}

const filenameRelativeIsAsset = (filenameRelative) => filenameRelative.match(/[^\/]+__asset__\/.+$/)
