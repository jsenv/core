import { serveFile } from "@jsenv/server"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import {
  COMPILE_ID_BUILD_GLOBAL,
  COMPILE_ID_BUILD_GLOBAL_FILES,
  COMPILE_ID_BUILD_COMMONJS,
  COMPILE_ID_BUILD_COMMONJS_FILES,
} from "../CONSTANTS.js"
import { jsenvBrowserSystemBuildUrl } from "../jsenvInternalFiles.js"
import { compileFile } from "./compileFile.js"

const compilerCandidates = []

export const createCompiledFileService = ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  importMapFileRelativeUrl,
  importMetaEnvFileRelativeUrl,
  importMeta,
  importDefaultExtension,

  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  babelPluginMap,
  groupMap,
  convertMap,
  scriptInjections,

  projectFileRequestedCallback,
  useFilesystemAsCache,
  writeOnFilesystem,
  compileCacheStrategy,
  sourcemapExcludeSources,
}) => {
  const jsenvBrowserBuildUrlRelativeToProject = urlToRelativeUrl(
    jsenvBrowserSystemBuildUrl,
    projectDirectoryUrl,
  )

  return (request) => {
    const { origin, ressource } = request
    const requestUrl = `${origin}${ressource}`
    const outDirectoryRemoteUrl = resolveDirectoryUrl(outDirectoryRelativeUrl, origin)
    // not inside compile directory -> nothing to compile
    if (!requestUrl.startsWith(outDirectoryRemoteUrl)) {
      return null
    }

    const afterOutDirectory = requestUrl.slice(outDirectoryRemoteUrl.length)

    // serve files inside /.jsenv/out/* directly without compilation
    // this is just to allow some files to be written inside outDirectory and read directly
    // if asked by the client (such as env.json, groupMap.json, meta.json)
    if (!afterOutDirectory.includes("/") || afterOutDirectory[0] === "/") {
      return serveFile(request, {
        rootDirectoryUrl: projectDirectoryUrl,
        etagEnabled: true,
      })
    }

    const parts = afterOutDirectory.split("/")
    const compileId = parts[0]
    const remaining = parts.slice(1).join("/")
    // no compileId, we don't know what to compile (not supposed so happen)
    if (compileId === "") {
      return null
    }

    const allowedCompileIds = [
      ...Object.keys(groupMap),
      COMPILE_ID_BUILD_GLOBAL,
      COMPILE_ID_BUILD_GLOBAL_FILES,
      COMPILE_ID_BUILD_COMMONJS,
      COMPILE_ID_BUILD_COMMONJS_FILES,
    ]

    if (!allowedCompileIds.includes(compileId)) {
      return {
        status: 400,
        statusText: `compileId must be one of ${allowedCompileIds}, received ${compileId}`,
      }
    }

    // nothing after compileId, we don't know what to compile (not supposed to happen)
    if (remaining === "") {
      return null
    }

    const originalFileRelativeUrl = remaining
    projectFileRequestedCallback(originalFileRelativeUrl, request)

    const originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`
    const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativeUrl,
      projectDirectoryUrl,
    )
    const compiledFileUrl = resolveUrl(originalFileRelativeUrl, compileDirectoryUrl)

    let compilerOptions = null
    const compilerCandidateParams = {
      compileServerOrigin: request.origin,
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      compileId,
      outDirectoryRelativeUrl,
      importMapFileRelativeUrl,
      importMetaEnvFileRelativeUrl,
      importDefaultExtension,

      moduleOutFormat,
      importMetaFormat,
      importMeta,
      groupMap,
      babelPluginMap,
      convertMap,
      transformTopLevelAwait,
      writeOnFilesystem,
      sourcemapExcludeSources,

      jsenvBrowserBuildUrlRelativeToProject,
      scriptInjections,
    }
    compilerCandidates.find((compilerCandidate) => {
      const returnValue = compilerCandidate(compilerCandidateParams)
      if (returnValue && typeof returnValue === "object") {
        compilerOptions = returnValue
        return true
      }
      return false
    })

    if (compilerOptions) {
      return compileFile({
        cancellationToken,
        logger,

        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,

        writeOnFilesystem: true, // we always need them
        useFilesystemAsCache,
        compileCacheStrategy,
        projectFileRequestedCallback,
        request,

        ...compilerOptions,
      })
    }

    // json, css etc does not need to be compiled, they are redirected to their source version that will be served as file
    return {
      status: 307,
      headers: {
        location: resolveUrl(originalFileRelativeUrl, origin),
      },
    }
  }
}
