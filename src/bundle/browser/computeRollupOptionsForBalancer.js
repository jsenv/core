import createNodeResolveRollupPlugin from "rollup-plugin-node-resolve"
import { uneval } from "@dmail/uneval"
import { projectFolder as selfProjectFolder } from "../../projectFolder.js"
import { groupToBabelPluginDescription } from "../../group-description/index.js"
import { babelPluginDescriptionToRollupPlugin } from "../babelPluginDescriptionToRollupPlugin.js"

export const computeRollupOptionsForBalancer = ({
  projectFolder,
  into,
  globalName,
  babelPluginDescription,
  groupDescription,
  entryFilenameRelative,
}) => {
  const balancerOptionSource = generateBalancerOptionsSource({
    globalName,
    groupDescription,
    entryFilenameRelative,
  })

  const browserBalancerRollupPlugin = {
    name: "browser-balancer",
    resolveId: (importee, importer) => {
      if (importee === "bundle-browser-options") {
        return "bundle-browser-options"
      }
      if (!importer) return importee
      return null
    },

    load: async (id) => {
      if (id === "bundle-browser-options") {
        return balancerOptionSource
      }
      return null
    },
  }

  const nodeResolveRollupPlugin = createNodeResolveRollupPlugin({
    module: true,
  })

  const otherwiseBabelPluginDescription = groupToBabelPluginDescription(
    groupDescription.otherwise,
    babelPluginDescription,
  )
  const babelRollupPlugin = babelPluginDescriptionToRollupPlugin({
    babelPluginDescription: otherwiseBabelPluginDescription,
  })

  return {
    rollupParseOptions: {
      input: `${selfProjectFolder}/src/bundle/browser/browser-balancer-template.js`,
      plugins: [browserBalancerRollupPlugin, nodeResolveRollupPlugin, babelRollupPlugin],
    },
    rollupGenerateOptions: {
      output: `${projectFolder}/${into}/${entryFilenameRelative}`,
      format: "iife",
      name: null,
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
  }
}

const generateBalancerOptionsSource = ({ globalName, entryFilenameRelative, groupDescription }) => {
  return `
export const globalName = ${uneval(globalName)}
export const entryFilenameRelative = ${uneval(entryFilenameRelative)}
export const groupDescription = ${uneval(groupDescription)}
`
}
