const createRollupPluginExternalGlobal = import.meta.require("rollup-plugin-external-globals")

export const createImportFromGlobalRollupPlugin = ({ platformGlobalName }) => {
  if (typeof platformGlobalName !== "string")
    throw new TypeError(`platformGlobalName must be a string, got ${platformGlobalName}.`)

  return createRollupPluginExternalGlobal(
    {
      global: platformGlobalName,
    },
    {
      exclude: [/\.json$/],
    },
  )
}
