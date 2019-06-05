import { extname, dirname, basename } from "path"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { platformClientBundleToCompilationResult } from "./platformClientBundleToCompilationResult.js"
import { generateBundle } from "./generate-bundle.js"

export const serveBundle = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapRelativePath = computeSourcemapRelativePath(compileRelativePath),
  babelPluginMap,
  headers,
  inlineSpecifierMap = {},
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

      const bundle = await generateBundle({
        projectPath: pathnameToOperatingSystemPath(projectPathname),
        bundleIntoRelativePath,
        importMapRelativePath,
        entryPointMap,
        inlineSpecifierMap,
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
        inlineSpecifierMap,
        entryRelativePath: sourceRelativePath,
        sourcemapRelativePath,
        bundle,
      })
    },
  })
}

const computeSourcemapRelativePath = (compileRelativePath) => {
  const entryBasename = basename(compileRelativePath)
  const sourcemapRelativePath = `/${entryBasename}__asset__/${entryBasename}.map`
  return sourcemapRelativePath
}
