export const applyRollupPlugins = async ({
  rollupPlugins,
  inputOptions = {},
  outputOptions,
}) => {
  const { rollup } = await import("rollup")
  const { importAssertions } = await import("acorn-import-assertions")
  const rollupReturnValue = await rollup({
    ...inputOptions,
    plugins: rollupPlugins,
    acornInjectPlugins: [
      importAssertions,
      ...(inputOptions.acornInjectPlugins || []),
    ],
  })
  const rollupOutputArray = await rollupReturnValue.generate(outputOptions)
  return rollupOutputArray
}
