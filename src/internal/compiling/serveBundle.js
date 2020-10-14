import { extname, basename } from "path"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl, urlIsInsideOf } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_GLOBAL_BUNDLE_FILES, COMPILE_ID_COMMONJS_BUNDLE_FILES } from "../CONSTANTS.js"
import { generateBundleUsingRollup } from "../bundling/generateBundleUsingRollup.js"
import { bundleToCompilationResult } from "../bundling/bundleToCompilationResult.js"
import { compileFile } from "./compileFile.js"

export const serveBundle = async ({
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
    const originalFileRelativeUrl = urlToRelativeUrl(originalFileUrl, projectDirectoryUrl)
    const entryExtname = extname(originalFileRelativeUrl)
    const entryBasename = basename(originalFileRelativeUrl, entryExtname)
    const entryName = entryBasename
    const entryPointMap = {
      [entryName]: `./${originalFileRelativeUrl}`,
    }
    const compileId =
      format === "global" ? COMPILE_ID_GLOBAL_BUNDLE_FILES : COMPILE_ID_COMMONJS_BUNDLE_FILES

    const bundle = await generateBundleUsingRollup({
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
      // bundleDirectoryUrl is just theorical because of writeOnFileSystem: false
      // but still important to know where the files will be written
      bundleDirectoryUrl: resolveDirectoryUrl("./", compiledFileUrl),
      writeOnFileSystem: false,
      sourcemapExcludeSources: true,
      manifestFile: false,
    })

    const sourcemapFileUrl = `${compiledFileUrl}.map`

    return bundleToCompilationResult(bundle, {
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
