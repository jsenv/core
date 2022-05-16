export const esToSystem = async ({ url, map, content }) => {
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
          return { external: true }
        },
        load: (id) => {
          if (id === url) {
            return content
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
  map = firstChunk.map
  content = firstChunk.code
  return {
    map,
    content,
  }
}
