import { pathnameToDirname } from "/node_modules/@jsenv/module-resolution/index.js"
import { uneval } from "/node_modules/@dmail/uneval/index.js"
import { createFeatureProviderRollupPlugin } from "../createFeatureProviderRollupPlugin.js"

const { projectFolder: selfProjectFolder } = import.meta.require("../../../jsenv.config.js")
const BUNDLE_BROWSER_OPTIONS_SPECIFIER = "\0bundle-browser-options.js"

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
    entryPointName,
    groupMap,
  })

  const browserBalancerRollupPlugin = {
    name: "browser-balancer",
    resolveId: (importee, importer) => {
      // it's important to keep the extension so that
      // rollup-plugin-babel transpiles bundle-browser-options.js too
      if (importee === BUNDLE_BROWSER_OPTIONS_SPECIFIER) {
        return BUNDLE_BROWSER_OPTIONS_SPECIFIER
      }
      if (!importer) return importee
      return null
    },

    load: async (id) => {
      if (id === BUNDLE_BROWSER_OPTIONS_SPECIFIER) {
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
    target: "browser",
  })

  log(`
bundle balancer file for browser
entryPointName: ${entryPointName}
file: ${file}
minify: ${minify}
`)

  return {
    rollupParseOptions: {
      input: `${selfProjectFolder}/src/bundle/browser/browser-balancer-template.js`,
      plugins: [browserBalancerRollupPlugin, featureProviderRollupPlugin],
    },
    rollupGenerateOptions: {
      file,
      format: "system",
      name: `./${entryPointName}.js`,
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
