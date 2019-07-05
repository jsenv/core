import { computeBabelPluginMapSubset } from "./computeBabelPluginMapSubset.js"
import { createBundleBabelPluginMap } from "./create-bundle-babel-plugin-map.js"

const { buildExternalHelpers } = import.meta.require("@babel/core")

const BABEL_HELPERS_FACADE_PATH = "/.jsenv/babelHelpers.js"

export const computeSpecifierMap = () => undefined

export const computeSpecifierDynamicMap = () => {
  return {
    [BABEL_HELPERS_FACADE_PATH]: () => {
      return {
        code: buildExternalHelpers(undefined, "module"),
        // babel helper must not be retransformed
        skipTransform: true,
      }
    },
  }
}

export const computeBabelPluginMap = ({
  projectPathname,
  format,
  babelPluginMap,
  featureNameArray,
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
      globalThisHelperRelativePath,
      babelHelpersFacadePath: BABEL_HELPERS_FACADE_PATH,
    }),
  }
}
