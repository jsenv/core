import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { computeBabelPluginMapSubset } from "./computeBabelPluginMapSubset.js"
import { createBundleBabelPluginMap } from "./create-bundle-babel-plugin-map.js"
import { JSENV_PATHNAME } from "../../JSENV_PATH.js"

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
  /**
   * donc dans le cas ou c'est chromium launcher qui
   * demande a generer un bundle rollup
   * ça fonctionne pour lui directement
   * mais si chromium-launcher est lui meme éxecuté
   * depuis sa version bundle avec rollup
   * alors la il chromium launcher se fait passer pour jsenv
   * du point de vue de cette partie du code
   * a reflechir
   * pour avoir le vrai filesystem path faudrait résoudre
   * le vrai chemin vers ce fichier
   */
  const globalThisFilesystemPath = pathnameToOperatingSystemPath(
    `${JSENV_PATHNAME}${globalThisHelperRelativePath}`,
  )

  return {
    ...computeBabelPluginMapSubset({
      babelPluginMap,
      featureNameArray,
    }),
    ...createBundleBabelPluginMap({
      projectPathname,
      format,
      globalThisFacadePath: globalThisHelperRelativePath,
      globalThisFilesystemPath,
      babelHelpersFacadePath: BABEL_HELPERS_FACADE_PATH,
    }),
  }
}
