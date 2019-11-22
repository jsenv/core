import { extname, basename } from "path"
import { COMPILE_ID_BUNDLE_GLOBAL, COMPILE_ID_BUNDLE_COMMONJS } from "internal/CONSTANTS.js"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { generateBundleUsingRollup } from "internal/bundling/generateBundleUsingRollup.js"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { serveCompiledFile } from "./serveCompiledFile.js"

export const serveBundle = async ({
  cancellationToken,
  logger,

  jsenvProjectDirectoryUrl = jsenvCoreDirectoryUrl,
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,

  format,
  formatOutputOptions = {},
  node = format === "commonjs",
  browser = format === "global",
  projectFileRequestedCallback,
  request,
  babelPluginMap,
}) => {
  if (typeof jsenvProjectDirectoryUrl !== "string") {
    throw new TypeError(
      `jsenvProjectDirectoryUrl must be a string, got ${jsenvProjectDirectoryUrl}`,
    )
  }

  const compile = async () => {
    const originalFileRelativeUrl = urlToRelativeUrl(originalFileUrl, projectDirectoryUrl)
    const entryExtname = extname(originalFileRelativeUrl)
    const entryBasename = basename(originalFileRelativeUrl, entryExtname)
    const entryName = entryBasename
    const entryPointMap = {
      [entryName]: `./${originalFileRelativeUrl}`,
    }
    const compileId = format === "global" ? COMPILE_ID_BUNDLE_GLOBAL : COMPILE_ID_BUNDLE_COMMONJS

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

      node,
      browser,
      babelPluginMap,
      format,
      formatOutputOptions,
      writeOnFileSystem: false,
    })

    const sourcemapFileUrl = `${compiledFileUrl}.map`

    return bundleToCompilationResult(bundle, {
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      sourcemapFileUrl,
      compileServerOrigin,
    })
  }

  return serveCompiledFile({
    logger,
    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    writeOnFilesystem: true,
    useFilesystemAsCache: true,
    projectFileRequestedCallback,
    compile,
    request,
  })
}
