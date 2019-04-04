import { isNativeNodeModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { uneval } from "/node_modules/@dmail/uneval/index.js"
import { createFeatureProviderRollupPlugin } from "../createFeatureProviderRollupPlugin.js"
import { pathnameToDirname } from "/node_modules/@jsenv/module-resolution/index.js"

const { projectFolder: selfProjectFolder } = import.meta.require("../../../jsenv.config.js")

const BUNDLE_NODE_OPTIONS_SPECIFIER = "\0bundle-node-options.js"

export const computeRollupOptionsForBalancer = ({
  projectFolder,
  into,
  babelConfigMap,
  groupMap,
  entryPointName,
  log,
  minify,
}) => {
  const balancerOptionSource = generateBalancerOptionsSource({
    groupMap,
    entryPointName,
  })

  const nodeBalancerRollupPlugin = {
    name: "node-balancer",
    resolveId: (importee, importer) => {
      // it's important to keep the extension so that
      // rollup-plugin-babel transpiles bundle-browser-options.js too
      if (importee === BUNDLE_NODE_OPTIONS_SPECIFIER) {
        return BUNDLE_NODE_OPTIONS_SPECIFIER
      }
      if (!importer) return importee
      return null
    },

    load: async (id) => {
      if (id === BUNDLE_NODE_OPTIONS_SPECIFIER) {
        return balancerOptionSource
      }
      return null
    },
  }

  const file = `${projectFolder}/${into}/${entryPointName}.js`

  const featureProviderRollupPlugin = createFeatureProviderRollupPlugin({
    dir: pathnameToDirname(file),
    featureNameArray: groupMap.otherwise.incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "node",
  })

  log(`
bundle balancer file for node.
entryPointName: ${entryPointName}
file: ${file}
minify : ${minify}
`)

  return {
    rollupParseOptions: {
      input: `${selfProjectFolder}/src/bundle/node/node-balancer-template.js`,
      plugins: [nodeBalancerRollupPlugin, featureProviderRollupPlugin],
      external: (id) => isNativeNodeModuleBareSpecifier(id),
    },
    rollupGenerateOptions: {
      file,
      format: "cjs",
      // name: null,
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
  }
}

const generateBalancerOptionsSource = ({ entryPointName, groupMap }) => {
  return `export const entryPointName = ${uneval(entryPointName)}
export const groupMap = ${uneval(groupMap)}`
}
