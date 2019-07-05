import { extname, dirname, basename } from "path"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { platformClientBundleToCompilationResult } from "./platformClientBundleToCompilationResult.js"
import { generateBundle } from "./generate-bundle.js"

export const serveBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  globalThisHelperRelativePath,
  specifierMap,
  specifierDynamicMap,
  sourceRelativePath,
  compileRelativePath,
  sourcemapPath,
  babelPluginMap,
  headers,
  format,
  formatOutputOptions = {},
}) => {
  return serveCompiledFile({
    projectPathname,
    headers,
    sourceRelativePath,
    compileRelativePath: `${compileIntoRelativePath}${compileRelativePath}`,
    compile: async () => {
      const entryExtname = extname(sourceRelativePath)
      const entryBasename = basename(sourceRelativePath, entryExtname)
      const entryDirname = dirname(sourceRelativePath)
      const entryName = entryBasename
      const bundleIntoRelativePath = entryDirname
        ? `${compileIntoRelativePath}${entryDirname}`
        : compileIntoRelativePath
      const entryPointMap = {
        [entryName]: sourceRelativePath,
      }

      const { bundle, relativePathAbstractArray } = await generateBundle({
        projectPath: pathnameToOperatingSystemPath(projectPathname),
        bundleIntoRelativePath,
        importMapRelativePath,
        globalThisHelperRelativePath,
        specifierMap,
        specifierDynamicMap,
        entryPointMap,
        babelPluginMap,
        compileGroupCount: 1,
        throwUnhandled: false,
        writeOnFileSystem: false,
        logLevel: "off",
        format,
        formatOutputOptions,
      })

      return platformClientBundleToCompilationResult({
        projectPathname,
        compileIntoRelativePath,
        relativePathAbstractArray,
        entryRelativePath: sourceRelativePath,
        sourcemapPath,
        sourcemapAssetPath: computeSourcemapAssetPath(compileRelativePath),
        bundle,
      })
    },
  })
}

const computeSourcemapAssetPath = (compileRelativePath) => {
  const entryBasename = basename(compileRelativePath)
  const sourcemapPath = `./${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapPath
}
