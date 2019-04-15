import { isNativeNodeModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { pathnameToDirname } from "/node_modules/@jsenv/module-resolution/index.js"
import { uneval } from "/node_modules/@dmail/uneval/index.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { ROOT_FOLDER } from "../../ROOT_FOLDER.js"

const BUNDLE_NODE_OPTIONS_SPECIFIER = "\0bundle-node-options.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
  projectFolder,
  into,
  babelConfigMap,
  groupMap,
  entryPointName,
  log,
  minify,
  logBundleFilePaths,
}) => {
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
        return generateBalancerOptionsSource({
          groupMap,
          entryPointName,
        })
      }
      return null
    },
  }

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "global",
  })

  const file = `${projectFolder}/${into}/${entryPointName}.js`

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative: null,
    dir: pathnameToDirname(file),
    featureNameArray: groupMap.otherwise.incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "node",
    logBundleFilePaths,
  })

  log(`
bundle balancer file for node.
entryPointName: ${entryPointName}
file: ${file}
minify : ${minify}
`)

  return {
    rollupParseOptions: {
      input: `file://${
        ROOT_FOLDER[0] === "/" ? ROOT_FOLDER : `/${ROOT_FOLDER}`
      }/src/bundle/node/node-balancer-template.js`,
      plugins: [nodeBalancerRollupPlugin, importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => isNativeNodeModuleBareSpecifier(id),
    },
    rollupGenerateOptions: {
      file,
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
