import { isNativeNodeModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { uneval } from "@dmail/uneval"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { relativePathInception } from "../../inception.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { createLogger } from "../../logger.js"

const NODE_BALANCER_TEMPLATE_RELATIVE_PATH = "/src/bundle/node/node-balancer-template.js"
const NODE_BALANCER_DATA_CLIENT_PATHNAME = "/.jsenv/node-balancer-data.js"
const NODE_GROUP_RESOLVER_CLIENT_PATHNAME = "/.jsenv/node-group-resolver.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  nodeGroupResolverRelativePath,
  babelPluginMap,
  groupMap,
  entryPointName,
  minify,
  logLevel,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "global",
  })

  const entryPointMap = {
    [entryPointName]: relativePathInception({
      projectPathname,
      relativePath: NODE_BALANCER_TEMPLATE_RELATIVE_PATH,
    }),
  }

  const inlineSpecifierMap = {
    [NODE_BALANCER_DATA_CLIENT_PATHNAME]: () =>
      generateBalancerOptionsSource({
        entryPointName,
        groupMap,
      }),
    [NODE_GROUP_RESOLVER_CLIENT_PATHNAME]: `${projectPathname}${relativePathInception({
      projectPathname,
      relativePath: nodeGroupResolverRelativePath,
    })}`,
  }

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
    target: "node",
    logLevel,
  })

  logTrace(`
bundle balancer file for node
entryPointName: ${entryPointName}
file: ${dir}/${entryPointName}.js
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
      sourcemapExcludeSources: true,
    },
  }
}

const generateBalancerOptionsSource = ({
  entryPointName,
  groupMap,
}) => `export const entryPointName = ${uneval(entryPointName)}
export const groupMap = ${uneval(groupMap)}`
