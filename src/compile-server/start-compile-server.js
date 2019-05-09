/* eslint-disable import/max-dependencies */
import { normalizePathname } from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { serveFile } from "../file-service/index.js"
import {
  acceptContentType,
  createSSERoom,
  startServer,
  serviceCompose,
  firstService,
} from "../server/index.js"
import { watchFile } from "../watchFile.js"
import { generateGroupMap } from "../group-map/index.js"
import {
  DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  DEFAULT_NODE_GROUP_RESOLVER_FILENAME_RELATIVE,
  DEFAULT_COMPILE_INTO,
  DEFAULT_BABEL_CONFIG_MAP,
  DEFAULT_BABEL_COMPAT_MAP,
  DEFAULT_BROWSER_SCORE_MAP,
  DEFAULT_NODE_VERSION_SCORE_MAP,
} from "./compile-server-constant.js"
import { serveBrowserPlatform } from "../browser-platform-service/index.js"
import { serveNodePlatform } from "../node-platform-service/index.js"
import { serveCompiledJs, filenameRelativeIsAsset } from "../compiled-js-service/index.js"

export const startCompileServer = async ({
  projectFolder,
  cancellationToken = createCancellationToken(),
  importMapFilenameRelative = DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  browserGroupResolverFilenameRelative = DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  nodeGroupResolverFilenameRelative = DEFAULT_NODE_GROUP_RESOLVER_FILENAME_RELATIVE,
  compileInto = DEFAULT_COMPILE_INTO,
  // option related to compile groups
  compileGroupCount = 1,
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  babelCompatMap = DEFAULT_BABEL_COMPAT_MAP,
  browserScoreMap = DEFAULT_BROWSER_SCORE_MAP,
  nodeVersionScoreMap = DEFAULT_NODE_VERSION_SCORE_MAP,
  // options related to how cache/hotreloading
  watchSource = false,
  watchSourcePredicate = () => true, // aybe we should exclude node_modules by default
  // js compile options
  transformTopLevelAwait = true,
  // options related to the server itself
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
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
    const originalWatchSourcePredicate = watchSourcePredicate
    watchSourcePredicate = (filenameRelative) => {
      // I doubt an asset like .js.map will change
      // in theory a compilation asset should not change
      // if the source file did not change
      // so we can avoid watching compilation asset
      if (filenameRelativeIsAsset(filenameRelative)) return false
      return originalWatchSourcePredicate(filenameRelative)
    }

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

  services.push((request) =>
    firstService(
      () =>
        serveImportMap({
          importMapFilenameRelative,
          request,
        }),
      () =>
        serveBrowserPlatform({
          projectFolder,
          importMapFilenameRelative,
          browserGroupResolverFilenameRelative,
          compileInto,
          babelConfigMap,
          groupMap,
          projectFileRequestedCallback,
          request,
        }),
      () =>
        serveNodePlatform({
          projectFolder,
          importMapFilenameRelative,
          nodeGroupResolverFilenameRelative,
          compileInto,
          babelConfigMap,
          groupMap,
          projectFileRequestedCallback,
          request,
        }),
      () =>
        serveCompiledJs({
          projectFolder,
          compileInto,
          groupMap,
          babelConfigMap,
          transformTopLevelAwait,
          projectFileRequestedCallback,
          request,
        }),
      () =>
        serveCompiledAsset({
          projectFolder,
          request,
        }),
      () =>
        serveProjectFolder({
          projectFolder,
          projectFileRequestedCallback,
          request,
        }),
    ),
  )

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    requestToResponse: serviceCompose(...services),
    verbose,
    cors,
  })
  // https://nodejs.org/api/net.html#net_server_unref
  // but while debugging it may close the server too soon, to be tested
  compileServer.nodeServer.unref()

  return compileServer
}

const serveImportMap = ({ importMapFilenameRelative, request: { origin, ressource } }) => {
  if (ressource !== "/.jsenv/importMap.json") return null

  return {
    status: 307,
    headers: {
      location: `${origin}/${importMapFilenameRelative}`,
    },
  }
}

const serveCompiledAsset = ({ projectFolder, request: { ressource, method, headers } }) => {
  if (!filenameRelativeIsAsset(ressource.slice(1))) return null
  return serveFile(`${projectFolder}${ressource}`, {
    method,
    headers,
    // because chrome seems to cache map files
    // meaning reloaidng the page will not update sourcemapped code
    // apparently not required anymore ?
    // cacheStrategy: "none",
  })
}

const serveProjectFolder = ({
  projectFolder,
  projectFileRequestedCallback,
  request: { ressource, method, headers },
}) => {
  const requestFilenameRelative = ressource.slice(1)

  // this way of finding the file can be removed once we have the
  // dynamic bundling no ?
  const requestFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: requestFilenameRelative,
  })
  const pathname = `${projectFolder}/${requestFilenameRelativeInception}`

  projectFileRequestedCallback({
    filenameRelative: requestFilenameRelativeInception,
    filename: pathname,
  })

  return serveFile(pathname, { method, headers })
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
