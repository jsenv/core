import { extname, basename } from "path"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { generateBundleUsingRollup } from "internal/bundling/generateBundleUsingRollup.js"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { serveCompiledFile } from "internal/compiling/serveCompiledFile.js"

export const serveBundle = async ({
  cancellationToken,
  logger,

  jsenvProjectDirectoryUrl,
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

    const bundle = await generateBundleUsingRollup({
      cancellationToken,
      logger,

      projectDirectoryUrl,
      entryPointMap,
      // bundleDirectoryUrl is just theorical because of writeOnFileSystem: false
      bundleDirectoryUrl: resolveDirectoryUrl("./bundle/", compiledFileUrl),
      importDefaultExtension,
      node,
      browser,

      babelPluginMap,
      compileServerOrigin,
      compileServerImportMap,
      compileDirectoryServerUrl: `${compileServerOrigin}/${urlToRelativeUrl(
        compileDirectoryUrl,
        projectDirectoryUrl,
      )}bundle/`,
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
    })
  }

  return serveCompiledFile({
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
