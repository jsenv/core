import { isNativeBrowserModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { uneval } from "@dmail/uneval"
import { resolveProjectFilename } from "../../resolveProjectFilename.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { ROOT_FOLDER } from "../../ROOT_FOLDER.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
  projectFolder,
  importMapFilenameRelative,
  browserGroupResolverFilenameRelative,
  into,
  babelConfigMap,
  groupMap,
  entryPointName,
  log,
  logBundleFilePaths,
  minify,
}) => {
  const entryPointMap = {
    [entryPointName]: "BROWSER_BALANCER.js",
  }

  const browserBalancerFilename = `${
    ROOT_FOLDER[0] === "/" ? ROOT_FOLDER : `/${ROOT_FOLDER}`
  }/src/bundle/browser/browser-balancer-template.js`

  const browserGroupResolverFilename = resolveProjectFilename({
    projectFolder,
    filenameRelative: browserGroupResolverFilenameRelative,
  })

  const inlineSpecifierMap = {
    ["BROWSER_BALANCER.js"]: browserBalancerFilename,
    ["BUNDLE_BROWSER_DATA.js"]: () =>
      generateBalancerOptionsSource({
        entryPointName,
        groupMap,
      }),
    ["BROWSER_GROUP_RESOLVER.js"]: browserGroupResolverFilename,
  }

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "window",
  })

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
    target: "browser",
    logBundleFilePaths,
  })

  log(`
bundle balancer file for browser
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
