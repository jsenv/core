import { extname, basename } from "path"
import { fileUrlToPath, resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { generateBundle } from "internal/bundling/generateBundle.js"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { serveCompiledFile } from "internal/compiling/serveCompiledFile.js"

export const serveBundle = async ({
  logger,
  jsenvProjectDirectoryUrl,
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  importDefaultExtension,
  importMapFileUrl,
  importReplaceMap = {},
  projectFileRequestedCallback,
  babelPluginMap,
  request,
  format,
  formatOutputOptions = {},
  node = format === "commonjs",
  browser = format === "global",
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

    const bundle = await generateBundle({
      logger,
      projectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
      // bundleDirectoryRelativeUrl is not really important
      // because we pass writeOnFileSystem: false anyway
      bundleDirectoryRelativeUrl: computeBundleDirectoryRelativeUrl({
        projectDirectoryUrl,
        compiledFileUrl,
      }),
      importDefaultExtension,
      importMapFileRelativeUrl: urlToRelativeUrl(importMapFileUrl, projectDirectoryUrl),
      importReplaceMap,
      entryPointMap,
      babelPluginMap,
      compileGroupCount: 1,
      throwUnhandled: false,
      writeOnFileSystem: false,
      format,
      formatOutputOptions,
      node,
      browser,
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

const computeBundleDirectoryRelativeUrl = ({ projectDirectoryUrl, compiledFileUrl }) => {
  const bundleDirectoryUrl = resolveDirectoryUrl("./", compiledFileUrl)
  const bundleDirectoryRelativeUrl = urlToRelativeUrl(bundleDirectoryUrl, projectDirectoryUrl)
  return bundleDirectoryRelativeUrl
}
