import { uneval } from "@dmail/uneval"
import { isNativeBrowserModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { relativePathInception } from "../inception.js"
import { createImportFromGlobalRollupPlugin } from "./import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "./jsenv-rollup-plugin/index.js"
import { createLogger } from "../logger.js"

const PLATFORM_GROUP_RESOLVER_CLIENT_PATHNAME = "/.jsenv/platform-group-resolver.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  platformGroupResolverRelativePath,
  babelPluginMap,
  groupMap,
  entryPointName,
  minify,
  logLevel,
  format,
  balancerTemplateRelativePath,
  balancerDataClientPathname,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "globalThis",
  })

  const entryPointMap = {
    [entryPointName]: relativePathInception({
      projectPathname,
      relativePath: balancerTemplateRelativePath,
    }),
  }

  const inlineSpecifierMap = {
    [balancerDataClientPathname]: () =>
      generateBalancerDataSource({
        entryPointName,
        groupMap,
      }),
    [PLATFORM_GROUP_RESOLVER_CLIENT_PATHNAME]: `${projectPathname}/${relativePathInception({
      projectPathname,
      relativePath: platformGroupResolverRelativePath,
    })}`,
  }

  // maybe it should be projectPath and not pathname here right ?
  const dir = pathnameToOperatingSystemPath(`${projectPathname}${bundleIntoRelativePath}`)

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectPathname,
    importMapRelativePath,
    inlineSpecifierMap,
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
      external: (id) => isNativeBrowserModuleBareSpecifier(id),
    },
    rollupGenerateOptions: {
      dir,
      format: formatToRollupFormat(format),
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
  }
}

const formatToRollupFormat = (format) => {
  if (format === "global") return "iife"
  if (format === "commonjs") return "cjs"
  if (format === "systemjs") return "system"
  throw new Error(`unexpected format, got ${format}`)
}

const generateBalancerDataSource = ({
  entryPointName,
  groupMap,
}) => `export const entryPointName = ${uneval(entryPointName)}
export const groupMap = ${uneval(groupMap)}`
