import { extname, basename } from "path"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { COMPILE_ID_GLOBAL_BUNDLE_FILES, COMPILE_ID_COMMONJS_BUNDLE_FILES } from "../CONSTANTS.js"
import { generateBundleUsingRollup } from "../bundling/generateBundleUsingRollup.js"
import { bundleToCompilationResult } from "../bundling/bundleToCompilationResult.js"
import { compileFile } from "./compileFile.js"

export const serveBundle = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,
  externalImportSpecifiers = [],
  compileCacheStrategy,

  format,
  formatOutputOptions = {},
  node = format === "commonjs",
  browser = format === "global",
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

      projectDirectoryUrl,
      entryPointMap,
      // bundleDirectoryUrl is just theorical because of writeOnFileSystem: false
      // but still important to know where the files will be written
      bundleDirectoryUrl: resolveDirectoryUrl("./", compiledFileUrl),
      compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
      compileServerOrigin,
      compileServerImportMap,
      importDefaultExtension,
      externalImportSpecifiers,

      node,
      browser,
      babelPluginMap,
      format,
      formatOutputOptions,
      writeOnFileSystem: false,
      sourcemapExcludeSources: true,
    })

    const sourcemapFileUrl = `${compiledFileUrl}.map`

    return bundleToCompilationResult(bundle, {
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      sourcemapFileUrl,
    })
  }

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
  })
}
