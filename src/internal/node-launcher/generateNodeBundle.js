import { extname, basename, relative } from "path"
import { generateImportMapForPackage } from "@jsenv/node-module-import-map"
import { createLogger } from "@jsenv/logger"
import {
  fileUrlToPath,
  resolveDirectoryUrl,
  urlToRelativeUrl,
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
  originalFileRelativeUrl,
  compiledFileRelativeUrl,
  babelPluginMap,
  logLevel,
  compileGroupCount,
  nodeScoreMap = jsenvNodeVersionScoreMap,
}) => {
  return getOrGenerateCompiledFile({
    projectDirectoryUrl,
    originalFileRelativeUrl,
    compiledFileRelativeUrl,
    cache: true,
    compile: async () => {
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
          compiledFileRelativeUrl,
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

      const sourcemapFileRelativeUrl = `${compiledFileRelativeUrl}/${entryBasename}__asset__/${entryBasename}.map`

      const sourcemapFileRelativeUrlForModule = `./${relative(
        compiledFileRelativeUrl,
        sourcemapFileRelativeUrl,
      )}`

      return bundleToCompilationResult(bundle, {
        projectDirectoryUrl,
        sourcemapFileRelativeUrl,
        sourcemapFileRelativeUrlForModule,
      })
    },
  })
}

const computeBundleDirectoryRelativeUrl = ({ projectDirectoryUrl, compiledFileRelativeUrl }) => {
  const compiledFileUrl = resolveFileUrl(compiledFileRelativeUrl, projectDirectoryUrl)
  const bundleDirectoryUrl = resolveDirectoryUrl("./", compiledFileUrl)
  const bundleDirectoryRelativeUrl = urlToRelativeUrl(bundleDirectoryUrl, projectDirectoryUrl)
  return bundleDirectoryRelativeUrl
}
