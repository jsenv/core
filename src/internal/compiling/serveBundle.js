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
  compileDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  importDefaultExtension,
  format,
  formatOutputOptions = {},
  node = format === "commonjs",
  browser = format === "global",

  projectFileRequestedCallback,
  request,
  compileServerOrigin,
  compileServerImportMap,
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
    const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)

    const bundle = await generateBundleUsingRollup({
      cancellationToken,
      logger,

      projectDirectoryUrl,
      entryPointMap,
      // bundleDirectoryUrl is just theorical because of writeOnFileSystem: false
      // but still important to know where the files will be written
      bundleDirectoryUrl: resolveDirectoryUrl("./", compiledFileUrl),
      importDefaultExtension,
      node,
      browser,

      babelPluginMap,
      compileServerOrigin,
      compileServerImportMap,
      compileDirectoryRelativeUrl: `${compileDirectoryRelativeUrl}${
        format === "global" ? COMPILE_ID_BUNDLE_GLOBAL : COMPILE_ID_BUNDLE_COMMONJS
      }/`,
      format,
      formatOutputOptions,
      writeOnFileSystem: false,
    })

    const sourcemapFileUrl = `${compiledFileUrl}.map`

    return bundleToCompilationResult(bundle, {
      projectDirectoryUrl,
      compileDirectoryUrl,
      compileServerOrigin,
      originalFileUrl,
      compiledFileUrl,
      sourcemapFileUrl,
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
