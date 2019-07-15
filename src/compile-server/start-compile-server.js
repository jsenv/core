/* eslint-disable import/max-dependencies */
import { createCancellationToken } from "@dmail/cancellation"
import {
  acceptsContentType,
  createServerSentEventsRoom,
  startServer,
  firstService,
  serveFile,
} from "@dmail/server"
import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { watchFile } from "../watchFile.js"
import { generateGroupMap } from "../group-map/index.js"
import { serveBrowserPlatform } from "../browser-platform-service/index.js"
import { serveNodePlatform } from "../node-platform-service/index.js"
import { serveCompiledJs, relativePathIsAsset } from "../compiled-js-service/index.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"
import { removeFolder } from "../removeFolder.js"
import { readProjectImportMap } from "../import-map/readProjectImportMap.js"
import { relativePathInception } from "../JSENV_PATH.js"
import { readCompileIntoMeta } from "./read-compile-into-meta.js"
import { writeCompileIntoMeta } from "./write-compile-into-meta.js"
import {
  DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_BROWSER_PLATFORM_RELATIVE_PATH,
  DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_NODE_PLATFORM_RELATIVE_PATH,
  DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_BABEL_PLUGIN_MAP,
  DEFAULT_BABEL_COMPAT_MAP,
  DEFAULT_BROWSER_SCORE_MAP,
  DEFAULT_NODE_VERSION_SCORE_MAP,
} from "./compile-server-constant.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  projectPath,
  compileIntoRelativePath = DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  importDefaultExtension,
  browserPlatformRelativePath = DEFAULT_BROWSER_PLATFORM_RELATIVE_PATH,
  browserGroupResolverRelativePath = DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  nodePlatformRelativePath = DEFAULT_NODE_PLATFORM_RELATIVE_PATH,
  nodeGroupResolverRelativePath = DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH,
  compileGroupCount = 1,
  platformAlwaysInsidePlatformScoreMap = false,
  babelPluginMap = DEFAULT_BABEL_PLUGIN_MAP,
  babelCompatMap = DEFAULT_BABEL_COMPAT_MAP,
  browserScoreMap = DEFAULT_BROWSER_SCORE_MAP,
  nodeVersionScoreMap = DEFAULT_NODE_VERSION_SCORE_MAP,
  // options related to how cache/hotreloading
  watchSource = false,
  watchSourcePredicate = () => true, // should we exclude node_modules by default ?
  // js compile options
  transformTopLevelAwait = true,
  // options related to the server itself
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  signature,
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  cleanCompileInto = false,
}) => {
  if (typeof projectPath !== "string")
    throw new TypeError(`projectPath must be a string. got ${projectPath}`)

  const projectPathname = operatingSystemPathToPathname(projectPath)

  const groupMap = generateGroupMap({
    babelPluginMap,
    babelCompatMap,
    platformScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: compileGroupCount,
    platformAlwaysInsidePlatformScoreMap,
  })

  const previousCompileIntoMeta = await readCompileIntoMeta({
    projectPathname,
    compileIntoRelativePath,
  })
  const compileIntoMeta = computeCompileIntoMeta({ babelPluginMap, groupMap })
  if (cleanCompileInto || shouldInvalidateCache({ previousCompileIntoMeta, compileIntoMeta })) {
    await removeFolder(
      pathnameToOperatingSystemPath(`${projectPathname}${compileIntoRelativePath}`),
    )
  }
  await writeCompileIntoMeta({ projectPathname, compileIntoRelativePath, compileIntoMeta })

  const importMap = await readProjectImportMap({ projectPathname, importMapRelativePath })

  browserPlatformRelativePath = relativePathInception({
    projectPathname,
    importMap,
    relativePath: browserPlatformRelativePath,
  })
  browserGroupResolverRelativePath = relativePathInception({
    projectPathname,
    importMap,
    relativePath: browserGroupResolverRelativePath,
  })
  nodePlatformRelativePath = relativePathInception({
    projectPathname,
    importMap,
    relativePath: nodePlatformRelativePath,
  })
  nodeGroupResolverRelativePath = relativePathInception({
    projectPathname,
    importMap,
    relativePath: nodeGroupResolverRelativePath,
  })

  // this callback will be called each time a projectFile was
  // used to respond to a request
  // it is not used yet but is meant to implement hotreloading
  // each time a client will need a project file we will watch that file
  // and a client can register to these events to reload the page
  // when a project file changed
  let projectFileRequestedCallback = () => {}

  let watchSSEService = () => null

  if (watchSource) {
    const originalWatchSourcePredicate = watchSourcePredicate
    watchSourcePredicate = (relativePath) => {
      // I doubt an asset like .js.map will change
      // in theory a compilation asset should not change
      // if the source file did not change
      // so we can avoid watching compilation asset
      if (relativePathIsAsset(relativePath)) return false
      return originalWatchSourcePredicate(relativePath)
    }

    const { registerFileChangedCallback, triggerFileChanged } = createFileChangedSignal()

    const watchedFiles = new Map()
    cancellationToken.register(() => {
      watchedFiles.forEach((closeWatcher) => closeWatcher())
      watchedFiles.clear()
    })
    projectFileRequestedCallback = (relativePath) => {
      const filePath = `${projectPath}${relativePath}`
      // when I ask for a compiled file, watch the corresponding file on filesystem
      // here we should use the registerFileLifecyle stuff made in
      // jsenv-eslint-import-resolver so support if file gets created/deleted
      // by the way this is not truly working if compile creates a bundle
      // in that case we should watch for the whole bundle
      // sources, for now let's ignore
      if (watchedFiles.has(filePath) === false && watchSourcePredicate(relativePath)) {
        const fileWatcher = watchFile(filePath, () => {
          triggerFileChanged({ relativePath })
        })
        watchedFiles.set(filePath, fileWatcher)
      }
    }

    const fileChangedSSE = createServerSentEventsRoom()

    fileChangedSSE.start()
    cancellationToken.register(fileChangedSSE.stop)

    registerFileChangedCallback(({ fileRelativePath }) => {
      fileChangedSSE.sendEvent({
        type: "file-changed",
        data: fileRelativePath,
      })
    })

    watchSSEService = ({ headers }) => {
      if (acceptsContentType(headers.accept, "text/event-stream")) {
        return fileChangedSSE.connect(headers["last-event-id"])
      }
      return null
    }
  }

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    requestToResponse: (request) =>
      firstService(
        () => watchSSEService(request),
        () =>
          serveImportMap({
            importMapRelativePath,
            request,
          }),
        () =>
          serveBrowserPlatform({
            projectPathname,
            compileIntoRelativePath,
            importMapRelativePath,
            importDefaultExtension,
            browserPlatformRelativePath,
            browserGroupResolverRelativePath,
            babelPluginMap,
            groupMap,
            projectFileRequestedCallback,
            request,
          }),
        () =>
          serveNodePlatform({
            projectPathname,
            compileIntoRelativePath,
            importMapRelativePath,
            importDefaultExtension,
            nodePlatformRelativePath,
            nodeGroupResolverRelativePath,
            babelPluginMap,
            groupMap,
            projectFileRequestedCallback,
            request,
          }),
        () =>
          serveCompiledJs({
            projectPathname,
            compileIntoRelativePath,
            groupMap,
            babelPluginMap,
            transformTopLevelAwait,
            projectFileRequestedCallback,
            request,
          }),
        () =>
          serveCompiledAsset({
            projectPathname,
            request,
          }),
        () =>
          serveProjectFiles({
            projectPathname,
            projectFileRequestedCallback,
            request,
          }),
      ),
    logLevel,
    cors,
    accessControlAllowRequestOrigin: true,
    accessControlAllowRequestMethod: true,
    accessControlAllowRequestHeaders: true,
    keepProcessAlive: false,
  })

  return compileServer
}

const serveImportMap = ({ importMapRelativePath, request: { origin, ressource } }) => {
  if (ressource !== "/.jsenv/importMap.json") return null

  return {
    status: 307,
    headers: {
      location: `${origin}/${importMapRelativePath}`,
    },
  }
}

const serveCompiledAsset = ({ projectPathname, request: { ressource, method, headers } }) => {
  if (!relativePathIsAsset(ressource)) return null

  return serveFile(`${projectPathname}${ressource}`, {
    method,
    headers,
    // because chrome seems to cache map files
    // meaning reloaidng the page will not update sourcemapped code
    // apparently not required anymore ?
    // cacheStrategy: "none",
  })
}

const serveProjectFiles = ({
  projectPathname,
  projectFileRequestedCallback,
  request: { ressource, method, headers },
}) => {
  projectFileRequestedCallback(ressource)

  return serveFile(`${projectPathname}${ressource}`, { method, headers })
}

const computeCompileIntoMeta = ({ babelPluginMap, groupMap }) => {
  return { babelPluginMap, groupMap }
}

const shouldInvalidateCache = ({ previousCompileIntoMeta, compileIntoMeta }) => {
  return (
    previousCompileIntoMeta &&
    JSON.stringify(previousCompileIntoMeta) !== JSON.stringify(compileIntoMeta)
  )
}

const createFileChangedSignal = () => {
  const fileChangedCallbackArray = []

  const registerFileChangedCallback = (callback) => {
    fileChangedCallbackArray.push(callback)
  }

  const triggerFileChanged = (data) => {
    const callbackArray = fileChangedCallbackArray.slice()
    callbackArray.forEach((callback) => {
      callback(data)
    })
  }

  return { registerFileChangedCallback, triggerFileChanged }
}
