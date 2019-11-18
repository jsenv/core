import { extname, basename } from "path"
import { generateImportMapForPackage } from "@jsenv/node-module-import-map"
import { createLogger } from "@jsenv/logger"
import { fileUrlToPath, resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { getOrGenerateCompiledFile } from "internal/compiling/compile-directory/getOrGenerateCompiledFile.js"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { generateCommonJsBundleForNode } from "src/generateCommonJsBundleForNode.js"
import { jsenvNodeVersionScoreMap } from "src/jsenvNodeVersionScoreMap.js"

export const generateNodeBundle = async ({
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

      const logger = createLogger({ logLevel })
      const jsenvNodeLauncherImportMap = await generateImportMapForPackage({
        logger,
        projectDirectoryPath: fileUrlToPath(jsenvCoreDirectoryUrl),
        rootProjectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
      })

      const bundle = await generateCommonJsBundleForNode({
        projectDirectoryPath: projectDirectoryUrl,
        // bundleDirectoryRelativeUrl is not really important
        // because we pass writeOnFileSystem: false anyway
        bundleDirectoryRelativeUrl: computeBundleDirectoryRelativeUrl({
          projectDirectoryUrl,
          compiledFileUrl,
        }),
        importDefaultExtension,
        importMapFileUrl,
        importMapForBundle: jsenvNodeLauncherImportMap,
        entryPointMap,
        babelPluginMap,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel,
        compileGroupCount,
        platformScoreMap: {
          node: nodeScoreMap,
        },
      })

      const sourcemapFileUrl = `${compiledFileUrl}__asset__/${entryBasename}${entryExtname}.map`

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
