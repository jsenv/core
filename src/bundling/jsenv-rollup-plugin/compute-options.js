import { computeBabelPluginMapSubset } from "./computeBabelPluginMapSubset.js"
import { createBundleBabelPluginMap } from "./create-bundle-babel-plugin-map.js"

const { buildExternalHelpers } = import.meta.require("@babel/core")

const BABEL_HELPERS_FACADE_PATH = "/.jsenv/babelHelpers.js"
const GLOBAL_THIS_FACADE_PATH = "/.jsenv/helpers/global-this.js"

export const computeSpecifierMap = () => undefined

export const computeSpecifierDynamicMap = () => {
  return {
    [GLOBAL_THIS_FACADE_PATH]: () => generateGlobalThisSource(),
    [BABEL_HELPERS_FACADE_PATH]: () => {
      return {
        code: buildExternalHelpers(undefined, "module"),
        // babel helper must not be retransformed
        skipTransform: true,
      }
    },
  }
}

const generateGlobalThisSource = () => `Object.defineProperty(Object.prototype, "__global__", {
  get: function() {
    return this
  },
  configurable: true,
})
var globalThis = __global__
delete Object.prototype.__global__
globalThis.globalThis = globalThis`

export const computeBabelPluginMap = ({
  projectPathname,
  format,
  babelPluginMap,
  featureNameArray,
  // global this being a relative path does not work
  // this is because it's hard to predict where global-this.js
  // wil be, or even this file
  // stuff gets bundled to common-js and becomes
  // dependencies or dependencies
  // for now global this source is just a string
  // eslint-disable-next-line no-unused-vars
  globalThisHelperRelativePath,
}) => {
  return {
    ...computeBabelPluginMapSubset({
      babelPluginMap,
      featureNameArray,
    }),
    ...createBundleBabelPluginMap({
      projectPathname,
      format,
      globalThisHelperRelativePath: GLOBAL_THIS_FACADE_PATH,
      babelHelpersFacadePath: BABEL_HELPERS_FACADE_PATH,
    }),
  }
}
