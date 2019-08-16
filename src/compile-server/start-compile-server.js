/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import { createCancellationToken } from "@dmail/cancellation"
import {
  defaultAccessControlAllowedHeaders,
  startServer,
  firstService,
  serveFile,
} from "@dmail/server"
import { registerFileLifecycle } from "@dmail/filesystem-watch"
import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { generateGroupMap } from "@jsenv/grouping"
import { serveBrowserPlatform } from "../browser-platform-service/index.js"
import { serveNodePlatform } from "../node-platform-service/index.js"
import { serveCompiledJs, relativePathIsAsset } from "../compiled-js-service/index.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"
import { removeFolder } from "../removeFolder.js"
import { JSENV_PATHNAME, jsenvRelativePathInception } from "../JSENV_PATH.js"
import { assertFile } from "../filesystem-assertions.js"
import { readCompileIntoMeta } from "./read-compile-into-meta.js"
import { writeCompileIntoMeta } from "./write-compile-into-meta.js"
import {
  DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
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
  browserPlatformRelativePath,
  nodePlatformRelativePath,
  compileGroupCount = 1,
  platformAlwaysInsidePlatformScoreMap = false,
  babelPluginMap = DEFAULT_BABEL_PLUGIN_MAP,
  convertMap = {},
  babelCompatMap = DEFAULT_BABEL_COMPAT_MAP,
  browserScoreMap = DEFAULT_BROWSER_SCORE_MAP,
  nodeVersionScoreMap = DEFAULT_NODE_VERSION_SCORE_MAP,
  projectFilePredicate = () => true,
  // this callback will be called each time a projectFile was
  // used to respond to a request
  // each time an execution needs a project file this callback
  // will be called.
  projectFileRequestedCallback = undefined,
  // js compile options
  transformTopLevelAwait = true,
  // options related to the server itself
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  signature,
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  cleanCompileInto = false,
  keepProcessAlive = false,
  stopOnPackageVersionChange = false,
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
  const packageVersion = readPackage().version
  const compileIntoMeta = {
    packageVersion,
    babelPluginMap,
    convertMap,
    groupMap,
  }
  if (cleanCompileInto || shouldInvalidateCache({ previousCompileIntoMeta, compileIntoMeta })) {
    await removeFolder(
      pathnameToOperatingSystemPath(`${projectPathname}${compileIntoRelativePath}`),
    )
  }
  await writeCompileIntoMeta({ projectPathname, compileIntoRelativePath, compileIntoMeta })

  if (typeof browserPlatformRelativePath === "undefined") {
    browserPlatformRelativePath = jsenvRelativePathInception({
      jsenvRelativePath: "/src/browser-platform-service/browser-platform/index.js",
      projectPathname,
    })
  }
  await assertFile(
    pathnameToOperatingSystemPath(`${projectPathname}${browserPlatformRelativePath}`),
  )

  if (typeof nodePlatformRelativePath === "undefined") {
    nodePlatformRelativePath = jsenvRelativePathInception({
      jsenvRelativePath: "/src/node-platform-service/node-platform/index.js",
      projectPathname,
    })
  }
  await assertFile(pathnameToOperatingSystemPath(`${projectPathname}${nodePlatformRelativePath}`))

  if (projectFileRequestedCallback) {
    if (typeof projectFileRequestedCallback !== "function") {
      throw new TypeError(
        `projectFileRequestedCallback must be a function, got ${projectFileRequestedCallback}`,
      )
    }
    const originalProjectFileRequestedCallback = projectFileRequestedCallback
    projectFileRequestedCallback = ({ relativePath, ...rest }) => {
      // I doubt an asset like .js.map will change
      // in theory a compilation asset should not change
      // if the source file did not change
      // so we can avoid watching compilation asset
      if (relativePathIsAsset(relativePath)) return

      if (projectFilePredicate(relativePath)) {
        originalProjectFileRequestedCallback({ relativePath, ...rest })
      }
    }
  } else {
    projectFileRequestedCallback = () => {}
  }

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    sendInternalErrorStack: true,
    requestToResponse: (request) =>
      firstService(
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
            convertMap,
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
    accessControlAllowRequestOrigin: true,
    accessControlAllowRequestMethod: true,
    accessControlAllowRequestHeaders: true,
    accessControlAllowedRequestHeaders: [
      ...defaultAccessControlAllowedHeaders,
      "x-jsenv-execution-id",
    ],
    accessControlAllowCredentials: true,
    keepProcessAlive,
  })

  if (stopOnPackageVersionChange) {
    const checkPackageVersion = () => {
      let packageObject
      try {
        packageObject = readPackage()
      } catch (e) {
        // package json deleted ? not a problem
        // let's wait for it to show back
        if (e.code === "ENOENT") return
        // package.json malformed ? not a problem
        // let's wait for use to fix it or filesystem to finish writing the file
        if (e.name === "SyntaxError") return
        throw e
      }

      if (packageVersion !== packageObject.version) {
        compileServer.stop(STOP_REASON_PACKAGE_VERSION_CHANGED)
      }
    }

    const unregister = registerFileLifecycle(packagePath, {
      added: checkPackageVersion,
      updated: checkPackageVersion,
    })
    compileServer.stoppedPromise.then(
      () => {
        unregister()
      },
      () => {},
    )
  }

  return compileServer
}

const packagePath = pathnameToOperatingSystemPath(`${JSENV_PATHNAME}/package.json`)
const readPackage = () => {
  const buffer = readFileSync(packagePath)
  const string = String(buffer)
  const packageObject = JSON.parse(string)
  return packageObject
}

export const STOP_REASON_PACKAGE_VERSION_CHANGED = {
  toString: () => `package version changed`,
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
  projectFileRequestedCallback({
    relativePath: ressource,
    // the client (browser or node) should send
    // somehow the execution-id if we want to read it here
    // for now there is no such thing.
    // It means any project file which is not a module cannot be associated
    // to a specific execution.
    executionId: headers["x-jsenv-execution-id"],
  })

  return serveFile(`${projectPathname}${ressource}`, { method, headers })
}

const shouldInvalidateCache = ({ previousCompileIntoMeta, compileIntoMeta }) => {
  return (
    previousCompileIntoMeta &&
    JSON.stringify(previousCompileIntoMeta) !== JSON.stringify(compileIntoMeta)
  )
}
