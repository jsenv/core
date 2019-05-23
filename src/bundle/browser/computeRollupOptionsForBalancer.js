import { uneval } from "@dmail/uneval"
import { isNativeBrowserModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { relativePathInception } from "../../inception.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { createLogger } from "../../logger.js"

const BROWSER_BALANCER_TEMPLATE_RELATIVE_PATH = "/src/bundle/browser/browser-balancer-template.js"
const BROWSER_BALANCER_DATA_CLIENT_PATHNAME = "/.jsenv/browser-balancer-data.js"
const BROWSER_GROUP_RESOLVER_CLIENT_PATHNAME = "/.jsenv/browser-group-resolver.js"

export const computeRollupOptionsForBalancer = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  browserGroupResolverRelativePath,
  babelPluginMap,
  groupMap,
  entryPointName,
  minify,
  logLevel,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "window",
  })

  const entryPointMap = {
    [entryPointName]: relativePathInception({
      projectPathname,
      relativePath: BROWSER_BALANCER_TEMPLATE_RELATIVE_PATH,
    }),
  }

  const inlineSpecifierMap = {
    [BROWSER_BALANCER_DATA_CLIENT_PATHNAME]: () =>
      generateBrowserBalancerDataSource({
        entryPointName,
        groupMap,
      }),
    [BROWSER_GROUP_RESOLVER_CLIENT_PATHNAME]: `${projectPathname}/${relativePathInception({
      projectPathname,
      relativePath: browserGroupResolverRelativePath,
    })}`,
  }

  // maybe it should be projectPath and not pathname here right ?
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
    target: "browser",
    logLevel,
  })

  logTrace(`
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
