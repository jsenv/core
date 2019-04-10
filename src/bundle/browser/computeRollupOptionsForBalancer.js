import { isNativeBrowserModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { pathnameToDirname } from "/node_modules/@jsenv/module-resolution/index.js"
import { uneval } from "/node_modules/@dmail/uneval/index.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { ROOT_FOLDER } from "../../ROOT_FOLDER.js"

const BUNDLE_BROWSER_OPTIONS_SPECIFIER = "\0bundle-browser-options.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
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
    resolveId: (specifier) => {
      // it's important to keep the extension so that
      // rollup-plugin-babel transpiles bundle-browser-options.js too
      if (specifier === BUNDLE_BROWSER_OPTIONS_SPECIFIER) {
        return BUNDLE_BROWSER_OPTIONS_SPECIFIER
      }
      return null
    },

    load: async (id) => {
      if (id === BUNDLE_BROWSER_OPTIONS_SPECIFIER) {
        return balancerOptionSource
      }
      return null
    },
  }

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "window",
  })

  const file = `${projectFolder}/${into}/${entryPointName}.js`

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMap: {},
    projectFolder,
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
      input: `file://${
        ROOT_FOLDER[0] === "/" ? ROOT_FOLDER : `/${ROOT_FOLDER}`
      }/src/bundle/browser/browser-balancer-template.js`,
      plugins: [browserBalancerRollupPlugin, importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => isNativeBrowserModuleBareSpecifier(id),
    },
    rollupGenerateOptions: {
      file,
      format: "iife",
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
