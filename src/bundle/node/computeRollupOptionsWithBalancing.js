import { isNativeNodeModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { createLogger } from "../../logger.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  entryPointMap,
  inlineSpecifierMap,
  babelPluginMap,
  groupMap,
  minify,
  logLevel,
  compileId,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const dir = pathnameToOperatingSystemPath(
    `${projectPathname}${bundleIntoRelativePath}/${compileId}`,
  )

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "global",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectPathname,
    importMapRelativePath,
    inlineSpecifierMap,
    dir,
    featureNameArray: groupMap[compileId].incompatibleNameArray,
    babelPluginMap,
    minify,
    target: "node",
    logLevel,
  })

  logTrace(`
bundle entry points for node with balancing.
compileId: ${compileId}
entryPointArray: ${Object.keys(entryPointMap)}
dir: ${dir}
minify: ${minify}
`)

  return {
    rollupParseOptions: {
      input: entryPointMap,
      plugins: [importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => isNativeNodeModuleBareSpecifier(id),
    },
    rollupGenerateOptions: {
      dir,
      format: "cjs",
      sourcemap: true,
      sourceMapExcludeSources: false,
    },
  }
}
