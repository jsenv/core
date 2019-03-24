import createNodeResolveRollupPlugin from "rollup-plugin-node-resolve"
import { uneval } from "@dmail/uneval"
import { projectFolder as selfProjectFolder } from "../../../projectFolder.js"
import { groupToBabelPluginDescription } from "../../group-description/index.js"
import { babelPluginDescriptionToRollupPlugin } from "../babelPluginDescriptionToRollupPlugin.js"

export const computeRollupOptionsForBalancer = ({
  projectFolder,
  into,
  babelPluginDescription,
  groupDescription,
  entryName,
  entryFilenameRelative,
  log,
  minify,
}) => {
  const balancerOptionSource = generateBalancerOptionsSource({
    groupDescription,
    entryFilenameRelative,
  })

  const nodeBalancerRollupPlugin = {
    name: "node-balancer",
    resolveId: (importee, importer) => {
      // it's important to keep the extension so that
      // rollup-plugin-babel transpiles bundle-browser-options.js too
      if (importee === "bundle-node-options.js") {
        return "bundle-node-options.js"
      }
      if (!importer) return importee
      return null
    },

    load: async (id) => {
      if (id === "bundle-node-options.js") {
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
    minify,
    minifyOptions: { toplevel: true },
  })

  const file = `${projectFolder}/${into}/${entryFilenameRelative}`

  log(`
bundle balancer file for node
entryName: ${entryName}
babelPluginNameArray: ${Object.keys(otherwiseBabelPluginDescription)}
file: ${file}
minify : ${minify}
`)

  return {
    rollupParseOptions: {
      input: `${selfProjectFolder}/src/bundle/node/node-balancer-template.js`,
      plugins: [nodeBalancerRollupPlugin, nodeResolveRollupPlugin, babelRollupPlugin],
    },
    rollupGenerateOptions: {
      file,
      format: "cjs",
      name: null,
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
  }
}

const generateBalancerOptionsSource = ({ entryFilenameRelative, groupDescription }) => {
  return `
export const entryFilenameRelative = ${uneval(entryFilenameRelative)}
export const groupDescription = ${uneval(groupDescription)}
`
}
