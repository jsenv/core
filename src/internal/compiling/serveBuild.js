import {
  resolveDirectoryUrl,
  resolveUrl,
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToBasename,
  urlToFilename,
} from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_BUILD_GLOBAL_FILES, COMPILE_ID_BUILD_COMMONJS_FILES } from "../CONSTANTS.js"
import { buildUsingRollup } from "../building/buildUsingRollup.js"
import { buildToCompilationResult } from "../building/buildToCompilationResult.js"
import { compileFile } from "./compileFile.js"

export const serveBuild = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  importMapFileRelativeUrl,
  originalFileUrl,
  compiledFileUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,
  externalImportSpecifiers = [],
  compileCacheStrategy,

  format,
  projectFileRequestedCallback,
  request,
  babelPluginMap,
}) => {
  const compile = async () => {
    const compileId =
      format === "global" ? COMPILE_ID_BUILD_GLOBAL_FILES : COMPILE_ID_BUILD_COMMONJS_FILES

    const originalFileRelativeUrl = urlToRelativeUrl(originalFileUrl, projectDirectoryUrl)
    const buildRelativeUrl =
      format === "commonjs"
        ? `${urlToBasename(originalFileUrl)}.cjs`
        : urlToFilename(originalFileUrl)

    const entryPointMap = {
      [`./${originalFileRelativeUrl}`]: `./${buildRelativeUrl}`,
    }

    const build = await buildUsingRollup({
      cancellationToken,
      logger,

      entryPointMap,
      projectDirectoryUrl,
      importMapFileRelativeUrl,
      compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
      compileServerOrigin,
      importDefaultExtension,
      externalImportSpecifiers,
      babelPluginMap,

      format,
      node: format === "commonjs",
      browser: format !== "commonjs",
      // buildDirectoryUrl is just theorical because of writeOnFileSystem: false
      // but still important to know where the files will be written
      buildDirectoryUrl: resolveDirectoryUrl("./", compiledFileUrl),
      writeOnFileSystem: false,
      sourcemapExcludeSources: true,
      manifestFile: false,
    })

    const sourcemapFileUrl = `${compiledFileUrl}.map`

    return buildToCompilationResult(build, {
      mainFileName: buildRelativeUrl,
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      sourcemapFileUrl,
    })
  }

  // might want to put this to false while working on jsenv
  // to that cache gets verified
  const isJenvInternalFile =
    false && urlIsInsideOf(originalFileUrl, resolveUrl("./src/internal/", jsenvCoreDirectoryUrl))

  return compileFile({
    logger,
    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    writeOnFilesystem: true,
    useFilesystemAsCache: true,
    compileCacheStrategy,
    projectFileRequestedCallback,
    compile,
    request,
    compileCacheSourcesValidation: !isJenvInternalFile,
    compileCacheAssetsValidation: !isJenvInternalFile,
  })
}
