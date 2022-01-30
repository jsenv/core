export const esToSystem = async ({ code, url, map }) => {
  const { rollup } = await import("rollup")
  const rollupBuild = await rollup({
    input: url,
    plugins: [
      {
        name: "es-to-system",
        resolveId: (id) => {
          if (id === url) {
            return id
          }
          return null
        },
        load: (id) => {
          if (id === url) {
            return code
          }
          return null
        },
      },
    ],
  })
  const { output } = await rollupBuild.generate({
    format: "system",
    sourcemap: true,
  })
  const firstChunk = output[0]
  code = firstChunk.code
  map = firstChunk.map
  return {
    code,
    map,
  }
}
