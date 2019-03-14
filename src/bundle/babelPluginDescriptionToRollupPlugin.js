import { transformAsync } from "@babel/core"
import { babelPluginDescriptionToBabelPluginArray } from "../jsCompile/babelPluginDescriptionToBabelPluginArray.js"

export const babelPluginDescriptionToRollupPlugin = ({ babelPluginDescription }) => {
  const babelPluginArray = babelPluginDescriptionToBabelPluginArray(babelPluginDescription)

  const babelRollupPlugin = {
    transform: (code, filename) => {
      return transformAsync(code, {
        filename,
        babelrc: false,
        plugins: babelPluginArray,
        parserOpts: {
          allowAwaitOutsideFunction: true,
        },
      })
    },
  }

  return babelRollupPlugin
}
