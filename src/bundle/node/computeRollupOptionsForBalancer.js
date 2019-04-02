import { isNativeNodeModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { uneval } from "/node_modules/@dmail/uneval/index.js"
import { createFeatureProviderRollupPlugin } from "../createFeatureProviderRollupPlugin.js"

const { projectFolder: selfProjectFolder } = import.meta.require("../../../jsenv.config.js")

const BUNDLE_NODE_OPTIONS_SPECIFIER = "\0bundle-node-options.js"

export const computeRollupOptionsForBalancer = ({
  projectFolder,
  into,
  babelConfigMap,
  groupMap,
  entryPoint,
  entryFilenameRelative,
  log,
  minify,
}) => {
  const balancerOptionSource = generateBalancerOptionsSource({
    groupMap,
    entryFilenameRelative,
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

  const featureProviderRollupPlugin = createFeatureProviderRollupPlugin({
    featureNameArray: groupMap.otherwise.incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "node",
  })

  const file = `${projectFolder}/${into}/${entryFilenameRelative}`

  log(`
bundle balancer file for node.
entryPoint: ${entryPoint}
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
      name: null,
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
  }
}

const generateBalancerOptionsSource = ({ entryFilenameRelative, groupMap }) => {
  return `
export const entryFilenameRelative = ${uneval(entryFilenameRelative)}
export const groupMap = ${uneval(groupMap)}
`
}
