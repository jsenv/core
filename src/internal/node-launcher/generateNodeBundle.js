import { extname, basename, relative } from "path"
import { generateImportMapForPackage } from "@jsenv/node-module-import-map"
import { createLogger } from "@jsenv/logger"
import {
  fileUrlToPath,
  resolveDirectoryUrl,
  urlToRelativePath,
  resolveFileUrl,
} from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { getOrGenerateCompiledFile } from "internal/compiling/compile-directory/getOrGenerateCompiledFile.js"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { generateCommonJsBundleForNode } from "src/generateCommonJsBundleForNode.js"
import { jsenvNodeVersionScoreMap } from "src/jsenvNodeVersionScoreMap.js"

export const generateNodeBundle = async ({
  projectDirectoryUrl,
  importMapFileUrl,
  importDefaultExtension,
  originalFileRelativePath,
  compiledFileRelativePath,
  sourcemapRelativePath = computeSourcemapRelativePath(compiledFileRelativePath),
  babelPluginMap,
  logLevel,
  compileGroupCount,
  nodeScoreMap = jsenvNodeVersionScoreMap,
}) => {
  return getOrGenerateCompiledFile({
    projectDirectoryUrl,
    originalFileRelativePath,
    compiledFileRelativePath,
    cache: true,
    compile: async () => {
      const entryExtname = extname(originalFileRelativePath)
      const entryBasename = basename(originalFileRelativePath, entryExtname)
      const entryName = entryBasename
      const entryPointMap = {
        [entryName]: `./${originalFileRelativePath}`,
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
        bundleDirectoryRelativeUrl: computebundleDirectoryRelativeUrl({
          projectDirectoryUrl,
          compiledFileRelativePath,
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

      const sourcemapPathForModule = sourcemapRelativePathToSourcemapPathForModule(
        sourcemapRelativePath,
        compiledFileRelativePath,
      )
      const sourcemapPathForCache = sourcemapRelativePathToSourcePathForCache(
        sourcemapRelativePath,
        compiledFileRelativePath,
      )

      return bundleToCompilationResult(bundle, {
        projectDirectoryUrl,
        sourcemapPathForModule,
        sourcemapPathForCache,
      })
    },
  })
}

const computebundleDirectoryRelativeUrl = ({ projectDirectoryUrl, compiledFileRelativePath }) => {
  const compiledFileUrl = resolveFileUrl(compiledFileRelativePath, projectDirectoryUrl)
  const bundleDirectoryUrl = resolveDirectoryUrl("./", compiledFileUrl)
  const bundleDirectoryRelativeUrl = urlToRelativePath(bundleDirectoryUrl, projectDirectoryUrl)
  return bundleDirectoryRelativeUrl
}

const computeSourcemapRelativePath = (compiledFileRelativePath) => {
  const entryBasename = basename(compiledFileRelativePath)
  const compiledFileAssetDirectoryRelativePath = `${compiledFileRelativePath}/${entryBasename}__asset__/`
  const sourcemapRelativePath = `${compiledFileAssetDirectoryRelativePath}${entryBasename}.map`
  return sourcemapRelativePath
}

const sourcemapRelativePathToSourcemapPathForModule = (
  sourcemapRelativePath,
  compiledFileRelativePath,
) => {
  return `./${relative(compiledFileRelativePath, sourcemapRelativePath)}`
}

const sourcemapRelativePathToSourcePathForCache = (
  sourcemapRelativePath,
  compiledFileRelativePath,
) => {
  const entryBasename = basename(compiledFileRelativePath)
  const compiledFileAssetDirectoryRelativePath = `${compiledFileRelativePath}/${entryBasename}__asset__/`
  return relative(compiledFileAssetDirectoryRelativePath, sourcemapRelativePath)
}
