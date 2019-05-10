import { isNativeBrowserModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { uneval } from "@dmail/uneval"
import { filenameRelativeInception } from "../../inception.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
  projectFolder,
  importMapFilenameRelative,
  browserGroupResolverFilenameRelative,
  into,
  babelConfigMap,
  groupMap,
  entryPointName,
  minify,
  log,
  logBundleFilePaths,
}) => {
  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "window",
  })

  const browserBalancerFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: "src/bundle/browser/browser-balancer-template.js",
  })

  const entryPointMap = {
    [entryPointName]: browserBalancerFilenameRelativeInception,
  }

  const browserGroupResolverFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserGroupResolverFilenameRelative,
  })

  const inlineSpecifierMap = {
    ["/.jsenv/browser-balancer-data.js"]: () =>
      generateBrowserBalancerDataSource({
        entryPointName,
        groupMap,
      }),
    ["/.jsenv/browser-group-resolver.js"]: `${projectFolder}/${browserGroupResolverFilenameRelativeInception}`,
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

const generateBrowserBalancerDataSource = ({
  entryPointName,
  groupMap,
}) => `export const entryPointName = ${uneval(entryPointName)}
export const groupMap = ${uneval(groupMap)}`
