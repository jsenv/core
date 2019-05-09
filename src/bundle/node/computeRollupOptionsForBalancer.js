import { isNativeNodeModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { uneval } from "@dmail/uneval"
import { filenameRelativeInception } from "../../inception.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
  projectFolder,
  importMapFilenameRelative,
  nodeGroupResolverFilenameRelative,
  into,
  babelConfigMap,
  groupMap,
  entryPointName,
  minify,
  log,
  logBundleFilePaths,
}) => {
  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "global",
  })

  const nodeBalancerFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: "node_modules/@jsenv/core/src/bundle/node/node-balancer-template.js",
  })

  const entryPointMap = {
    [entryPointName]: nodeBalancerFilenameRelativeInception,
  }

  const nodeGroupResolverFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: nodeGroupResolverFilenameRelative,
  })

  const inlineSpecifierMap = {
    ["/.jsenv/node-balancer-data.js"]: () =>
      generateBalancerOptionsSource({
        entryPointName,
        groupMap,
      }),
    ["/.jsenv/node-group-resolver.js"]: `${projectFolder}/${nodeGroupResolverFilenameRelativeInception}`,
  }

  const dir = `${projectFolder}/${into}`

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative,
    inlineSpecifierMap,
    dir,
    featureNameArray: groupMap.otherwise.incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "node",
    logBundleFilePaths,
  })

  log(`
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
