import MagicString from "magic-string"
import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { babelPluginDescriptionToRollupPlugin } from "../babelPluginDescriptionToRollupPlugin.js"
import { globalNameToPromiseGlobalName } from "./globalNameToPromiseGlobalName.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  projectFolder,
  into,
  globalName,
  entryPointsDescription,
  babelPluginDescription,
  autoWrapEntryInPromise,
}) => {
  const rollupPluginArray = [
    createJsenvRollupPlugin({
      cancellationToken,
      projectFolder,
    }),
    babelPluginDescriptionToRollupPlugin({
      babelPluginDescription,
    }),
    ...(autoWrapEntryInPromise
      ? [
          createIIFEPromiseRollupPlugin({
            projectFolder,
            globalName,
          }),
        ]
      : []),
  ]

  return {
    rollupParseOptions: {
      input: entryPointsDescription,
      plugins: rollupPluginArray,
    },
    rollupGenerateOptions: {
      // https://rollupjs.org/guide/en#output-dir
      dir: `${projectFolder}/${into}`,
      // https://rollupjs.org/guide/en#output-format
      format: "iife",
      name: globalName,
      // https://rollupjs.org/guide/en#output-sourcemap
      sourcemap: true,
      sourceMapExcludeSources: true,
    },
  }
}

const createIIFEPromiseRollupPlugin = ({ globalName }) => {
  return {
    name: "iife-promise",

    // https://rollupjs.org/guide/en#renderchunk
    renderChunk: (code) => {
      const magicString = new MagicString(code)
      magicString.append(`
var ${globalNameToPromiseGlobalName(globalName)} = Promise.resolve(${globalName})`)
      const map = magicString.generateMap({ hires: true })
      const renderedCode = magicString.toString()
      return { code: renderedCode, map }
    },
  }
}
