import { generateBundleUsingRollup } from "./generate-bundle-using-rollup.js"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createImportFromGlobalRollupPlugin } from "./import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "./jsenv-rollup-plugin/index.js"
import { createLogger } from "../logger.js"
import {
  computeSpecifierMap,
  computeSpecifierDynamicMap,
  computeBabelPluginMap,
} from "./jsenv-rollup-plugin/compute-options.js"

const PLATFORM_GROUP_RESOLVER_CLIENT_PATHNAME = "/.jsenv/platform-group-resolver.js"

export const bundleBalancer = async ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importDefaultExtension,
  importMap,
  specifierMap,
  specifierDynamicMap,
  nativeModulePredicate,
  entryPointMap,
  babelPluginMap,
  minify,
  logLevel,
  format,
  balancerDataClientPathname,
  platformGroupResolverRelativePath,
  groupMap,
  writeOnFileSystem,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const entryPointName = Object.keys(entryPointMap)[0]
  const dir = pathnameToOperatingSystemPath(`${projectPathname}${bundleIntoRelativePath}`)
  specifierMap = {
    ...specifierMap,
    ...computeSpecifierMap(),
    [PLATFORM_GROUP_RESOLVER_CLIENT_PATHNAME]: platformGroupResolverRelativePath,
  }
  specifierDynamicMap = {
    ...specifierDynamicMap,
    ...computeSpecifierDynamicMap(),
    [balancerDataClientPathname]: () => `export const entryPointName = ${JSON.stringify(
      entryPointName,
    )}
export const groupMap = ${JSON.stringify(groupMap)}`,
  }
  babelPluginMap = computeBabelPluginMap({
    projectPathname,
    format,
    babelPluginMap,
    featureNameArray: groupMap.otherwise.incompatibleNameArray,
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectPathname,
    importDefaultExtension,
    importMap,
    specifierMap,
    specifierDynamicMap,
    dir,
    babelPluginMap,
    minify,
    format,
    logLevel,
  })

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "globalThis",
  })

  logTrace(`
  bundle balancer file.
  format: ${format}
  entryPointName: ${entryPointName}
  file: ${dir}/${entryPointName}.js
  minify: ${minify}
  `)

  const bundle = await generateBundleUsingRollup({
    cancellationToken,
    writeOnFileSystem,
    rollupParseOptions: {
      input: entryPointMap,
      plugins: [importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => nativeModulePredicate(id),
    },
    rollupGenerateOptions: {
      dir,
      format: "iife",
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
  })

  return { bundle }
}
