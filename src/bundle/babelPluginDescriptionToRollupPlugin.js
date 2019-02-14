import createBabelRollupPlugin from "rollup-plugin-babel"
import { babelPluginDescriptionToBabelPluginArray } from "../jsCompile/babelPluginDescriptionToBabelPluginArray.js"

export const babelPluginDescriptionToRollupPlugin = ({ babelPluginDescription }) => {
  const babelPluginArray = babelPluginDescriptionToBabelPluginArray(babelPluginDescription)

  const babelRollupPlugin = createBabelRollupPlugin({
    babelrc: false,
    plugins: babelPluginArray,
    parserOpts: {
      allowAwaitOutsideFunction: true,
    },
  })

  return babelRollupPlugin
}
