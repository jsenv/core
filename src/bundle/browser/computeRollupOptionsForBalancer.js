import createNodeResolveRollupPlugin from "rollup-plugin-node-resolve"
import { uneval } from "@dmail/uneval"
import { projectFolder as selfProjectFolder } from "../../../projectFolder.js"
import { createFeatureProviderRollupPlugin } from "../createFeatureProviderRollupPlugin.js"

const BUNDLE_BROWSER_OPTIONS_SPECIFIER = "\0bundle-browser-options.js"

export const computeRollupOptionsForBalancer = ({
  projectFolder,
  into,
  globalName,
  globalNameIsPromise,
  babelConfigMap,
  groupMap,
  entryPoint,
  entryFilenameRelative,
  log,
  minify,
}) => {
  const balancerOptionSource = generateBalancerOptionsSource({
    globalName,
    globalNameIsPromise,
    groupMap,
    entryFilenameRelative,
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

  const nodeResolveRollupPlugin = createNodeResolveRollupPlugin({
    module: true,
  })

  const featureProviderRollupPlugin = createFeatureProviderRollupPlugin({
    featureNameArray: groupMap.otherwise.incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "browser",
  })

  const file = `${projectFolder}/${into}/${entryFilenameRelative}`

  log(`
bundle balancer file for browser
entryPoint: ${entryPoint}
file: ${file}
minify: ${minify}
`)

  return {
    rollupParseOptions: {
      input: `${selfProjectFolder}/src/bundle/browser/browser-balancer-template.js`,
      plugins: [browserBalancerRollupPlugin, nodeResolveRollupPlugin, featureProviderRollupPlugin],
    },
    rollupGenerateOptions: {
      file,
      format: "iife",
      name: globalName,
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
  }
}

const generateBalancerOptionsSource = ({
  globalName,
  globalNameIsPromise,
  entryFilenameRelative,
  groupMap,
}) => `export const globalName = ${uneval(globalName)}
export const globalNameIsPromise = ${uneval(globalNameIsPromise)}
export const entryFilenameRelative = ${uneval(entryFilenameRelative)}
export const groupMap = ${uneval(groupMap)}`
