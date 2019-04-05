// import { pathnameToDirname } from "/node_modules/@jsenv/module-resolution/index.js"
import { uneval } from "@dmail/uneval"
import { createFeatureProviderRollupPlugin } from "../../bundle/createFeatureProviderRollupPlugin.js"
import { createJsenvRollupPlugin } from "../../bundle/createJsenvRollupPlugin.js"
import { bundleWithRollup } from "../../bundle/bundleWithRollup.js"
import { ROOT_FOLDER } from "../../ROOT_FOLDER.js"

const SELF_IMPORT_OPTIONS_SPECIFIER = "\0self-import-options"

export const generateSelfImportIIFE = async ({
  cancellationToken,
  importMap,
  compileInto,
  // maybe we should not consider the one passed by user
  // an use an other ?
  babelConfigMap,
  compileServerOrigin,
  filenameRelative,
}) => {
  const selfImportOptionsSource = generateSelfImportOptionsSource({
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })

  const selfImportRollupPlugin = {
    name: "browser-balancer",
    resolveId: (importee, importer) => {
      // it's important to keep the extension so that
      // rollup-plugin-babel transpiles bundle-browser-options.js too
      if (importee === SELF_IMPORT_OPTIONS_SPECIFIER) {
        return SELF_IMPORT_OPTIONS_SPECIFIER
      }
      if (!importer) return importee
      return null
    },

    load: async (id) => {
      if (id === SELF_IMPORT_OPTIONS_SPECIFIER) {
        return selfImportOptionsSource
      }
      return null
    },
  }

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMap,
    projectFolder: ROOT_FOLDER,
  })

  const featureProviderRollupPlugin = createFeatureProviderRollupPlugin({
    featureNameArray: Object.keys(babelConfigMap),
    babelConfigMap,
    minify: false,
    target: "browser",
  })

  const { output } = await bundleWithRollup({
    rollupParseOptions: {
      input: `${ROOT_FOLDER}/src/browsing-server/self-import-iife/self-import-template.js`,
      plugins: [selfImportRollupPlugin, featureProviderRollupPlugin, jsenvRollupPlugin],
    },
    rollupGenerateOptions: {
      // file,
      format: "iife",
      sourcemap: "inline",
      sourcemapExcludeSources: false,
    },
    writeOnFileSystem: false,
  })

  return output[0]
}

const generateSelfImportOptionsSource = ({
  compileInto,
  compileServerOrigin,
  filenameRelative,
}) => `export const compileInto = ${uneval(compileInto)}
export const compileServerOrigin = ${uneval(compileServerOrigin)}
export const filenameRelative = ${uneval(filenameRelative)}`
