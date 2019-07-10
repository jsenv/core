import { extname, dirname, basename } from "path"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { generateBundle, bundleToCompilationResult } from "@jsenv/bundling"
import { serveCompiledFile } from "../compiled-file-service/index.js"

export const serveBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapPath,
  importMapRelativePath,
  specifierMap,
  specifierDynamicMap,
  projectFileRequestedCallback,
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
    projectFileRequestedCallback,
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

      const bundle = await generateBundle({
        projectPath: pathnameToOperatingSystemPath(projectPathname),
        bundleIntoRelativePath,
        importMapRelativePath,
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

      return bundleToCompilationResult(bundle, {
        projectPathname,
        compileIntoRelativePath,
        entryRelativePath: sourceRelativePath,
        sourcemapPath,
        sourcemapAssetPath: computeSourcemapAssetPath(compileRelativePath),
      })
    },
  })
}

const computeSourcemapAssetPath = (compileRelativePath) => {
  const entryBasename = basename(compileRelativePath)
  const sourcemapPath = `./${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapPath
}
