import { fileURLToPath, pathToFileURL } from "node:url"
import { isFileSystemPath } from "@jsenv/urls"
import { writeFile } from "@jsenv/filesystem"

const esToCjs = async ({ url, map, content }) => {
  const { rollup } = await import("rollup")
  const rollupBuild = await rollup({
    input: fileURLToPath(url),
    plugins: [
      {
        resolveId: async (id, importer = fileURLToPath(url)) => {
          if (
            id === "parse5" ||
            id === "acorn" ||
            id === "postcss" ||
            id === "acorn-import-assertions" ||
            id === "@babel/core" ||
            importer.includes("/node_modules/")
          ) {
            return { id, external: true }
          }
          if (id.startsWith("node:")) {
            return { id, external: true }
          }
          if (isFileSystemPath(id)) {
            id = pathToFileURL(id)
          }
          const url = await import.meta.resolve(id, pathToFileURL(importer))
          if (url.startsWith("node:")) {
            return { id: url, external: true }
          }
          const path = fileURLToPath(new URL(url))
          return path
        },
        outputOptions: (outputOptions) => {
          outputOptions.paths = (id) => {
            if (id.startsWith("node:")) {
              return id.slice("node:".length)
            }
            return null
          }
        },
      },
    ],
  })
  const { output } = await rollupBuild.generate({
    format: "esm",
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
const { content } = await esToCjs({
  url: new URL("../src/main.js", import.meta.url).href,
})
await writeFile(new URL("../dist/main.js", import.meta.url), content)
