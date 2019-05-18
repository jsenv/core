import { isNativeNodeModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { pathnameToOperatingSystemPath } from "../../operating-system-path.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { createLogger } from "../../logger.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  entryPointMap,
  inlineSpecifierMap,
  babelConfigMap,
  minify,
  logLevel,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const dir = pathnameToOperatingSystemPath(`${projectPathname}${bundleIntoRelativePath}`)

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "global",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectPathname,
    importMapRelativePath,
    inlineSpecifierMap,
    dir,
    featureNameArray: Object.keys(babelConfigMap),
    babelConfigMap,
    minify,
    target: "node",
    logLevel,
  })

  logTrace(`
bundle entry points for node without balancing.
entry point names: ${Object.keys(entryPointMap)}
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
      // https://rollupjs.org/guide/en#output-dir
      dir,
      // https://rollupjs.org/guide/en#output-format
      format: "cjs",
      // https://rollupjs.org/guide/en#output-sourcemap
      sourcemap: true,
      sourceMapExcludeSources: false,
    },
  }
}
