import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createImportFromGlobalRollupPlugin } from "./import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "./jsenv-rollup-plugin/index.js"
import { createLogger } from "../logger.js"

const PLATFORM_GROUP_RESOLVER_CLIENT_PATHNAME = "/.jsenv/platform-group-resolver.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  specifierMap,
  specifierDynamicMap,
  nativeModulePredicate,
  babelPluginMap,
  entryPointName,
  minify,
  logLevel,
  format,
  balancerTemplateRelativePath,
  balancerDataClientPathname,
  platformGroupResolverRelativePath,
  groupMap,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "globalThis",
  })

  const entryPointMap = {
    [entryPointName]: balancerTemplateRelativePath,
  }

  // maybe it should be projectPath and not pathname here right ?
  const dir = pathnameToOperatingSystemPath(`${projectPathname}${bundleIntoRelativePath}`)

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectPathname,
    importMapRelativePath,
    importDefaultExtension,
    specifierMap: {
      ...specifierMap,
      [PLATFORM_GROUP_RESOLVER_CLIENT_PATHNAME]: platformGroupResolverRelativePath,
    },
    specifierDynamicMap: {
      ...specifierDynamicMap,
      [balancerDataClientPathname]: () =>
        generateBalancerDataSource({
          entryPointName,
          groupMap,
        }),
    },
    dir,
    featureNameArray: groupMap.otherwise.incompatibleNameArray,
    babelPluginMap,
    minify,
    format,
    logLevel,
  })

  logTrace(`
bundle balancer file.
format: ${format}
entryPointName: ${entryPointName}
file: ${dir}/${entryPointName}.js
minify: ${minify}
`)

  return {
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
  }
}

const generateBalancerDataSource = ({
  entryPointName,
  groupMap,
}) => `export const entryPointName = ${JSON.stringify(entryPointName)}
export const groupMap = ${JSON.stringify(groupMap)}`
