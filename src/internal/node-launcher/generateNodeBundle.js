import { extname, basename } from "path"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { getOrGenerateCompiledFile } from "internal/compiling/compile-directory/getOrGenerateCompiledFile.js"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { generateCommonJsBundleForNode } from "src/generateCommonJsBundleForNode.js"
import { jsenvNodeVersionScoreMap } from "src/jsenvNodeVersionScoreMap.js"

export const generateNodeBundle = async ({
  logger,
  projectDirectoryUrl,
  importMapFileUrl,
  importDefaultExtension,
  originalFileUrl,
  compiledFileUrl,
  babelPluginMap,
  logLevel,
  compileGroupCount,
  nodeScoreMap = jsenvNodeVersionScoreMap,
}) => {
  return getOrGenerateCompiledFile({
    logger,
    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    writeOnFilesystem: true,
    useFilesystemAsCache: true,
    compile: async () => {
      const originalFileRelativeUrl = urlToRelativeUrl(originalFileUrl, projectDirectoryUrl)
      const entryExtname = extname(originalFileRelativeUrl)
      const entryBasename = basename(originalFileRelativeUrl, entryExtname)
      const entryName = entryBasename
      const entryPointMap = {
        [entryName]: `./${originalFileRelativeUrl}`,
      }

      const bundle = await generateCommonJsBundleForNode({
        logLevel,
        projectDirectoryPath: projectDirectoryUrl,
        // bundleDirectoryRelativeUrl is not really important
        // because we pass writeOnFileSystem: false anyway
        bundleDirectoryRelativeUrl: computeBundleDirectoryRelativeUrl({
          projectDirectoryUrl,
          compiledFileUrl,
        }),
        importDefaultExtension,
        importMapFileUrl,
        entryPointMap,
        babelPluginMap,
        throwUnhandled: false,
        writeOnFileSystem: false,
        compileGroupCount,
        platformScoreMap: {
          node: nodeScoreMap,
        },
      })

      const sourcemapFileUrl = `${compiledFileUrl}.map`
      return bundleToCompilationResult(bundle, {
        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
      })
    },
  })
}

const computeBundleDirectoryRelativeUrl = ({ projectDirectoryUrl, compiledFileUrl }) => {
  const bundleDirectoryUrl = resolveDirectoryUrl("./", compiledFileUrl)
  const bundleDirectoryRelativeUrl = urlToRelativeUrl(bundleDirectoryUrl, projectDirectoryUrl)
  return bundleDirectoryRelativeUrl
}
